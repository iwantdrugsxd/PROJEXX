const mongoose = require('mongoose');

const studentTeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    minlength: [2, 'Team name must be at least 2 characters'],
    maxlength: [100, 'Team name cannot exceed 100 characters'],
    index: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Team description cannot exceed 500 characters'],
    default: ''
  },
  
  projectServer: {
    type: String,
    required: [true, 'Project server code is required'],
    uppercase: true,
    trim: true,
    index: true
  },
  
  // Team members
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  }],
  
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Team leader is required'],
    validate: {
      validator: function(v) {
        return this.members.includes(v);
      },
      message: 'Team leader must be a member of the team'
    }
  },
  
  // Team settings
  maxMembers: {
    type: Number,
    default: 5,
    min: [2, 'Team must have at least 2 members'],
    max: [20, 'Team cannot have more than 20 members']
  },
  
  isOpen: {
    type: Boolean,
    default: true
  },
  
  // Team status
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed', 'disbanded'],
    default: 'active',
    index: true
  },
  
  // Join requests
  joinRequests: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: [200, 'Join request message cannot exceed 200 characters'],
      default: ''
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],
  
  // Team performance
  performance: {
    totalTasks: {
      type: Number,
      default: 0,
      min: 0
    },
    completedTasks: {
      type: Number,
      default: 0,
      min: 0
    },
    averageGrade: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    totalSubmissions: {
      type: Number,
      default: 0,
      min: 0
    },
    onTimeSubmissions: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Team creation info
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Creator is required']
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
studentTeamSchema.index({ projectServer: 1, name: 1 }, { unique: true });
studentTeamSchema.index({ projectServer: 1, status: 1 });
studentTeamSchema.index({ members: 1 });
studentTeamSchema.index({ leader: 1 });

// Virtual fields
studentTeamSchema.virtual('memberCount').get(function() {
  return this.members ? this.members.length : 0;
});

studentTeamSchema.virtual('completionRate').get(function() {
  if (this.performance.totalTasks === 0) return 0;
  return Math.round((this.performance.completedTasks / this.performance.totalTasks) * 100);
});

studentTeamSchema.virtual('onTimeRate').get(function() {
  if (this.performance.totalSubmissions === 0) return 0;
  return Math.round((this.performance.onTimeSubmissions / this.performance.totalSubmissions) * 100);
});

studentTeamSchema.virtual('isFull').get(function() {
  return this.memberCount >= this.maxMembers;
});

studentTeamSchema.virtual('availableSlots').get(function() {
  return Math.max(0, this.maxMembers - this.memberCount);
});

// Pre-save middleware
studentTeamSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Ensure leader is in members array
  if (this.leader && !this.members.includes(this.leader)) {
    this.members.push(this.leader);
  }
  
  // Validate member count
  if (this.members.length > this.maxMembers) {
    return next(new Error(`Team cannot have more than ${this.maxMembers} members`));
  }
  
  next();
});

// Instance methods
studentTeamSchema.methods.addMember = function(studentId) {
  if (this.isFull) {
    throw new Error('Team is full');
  }
  
  if (this.members.includes(studentId)) {
    throw new Error('Student is already a member');
  }
  
  this.members.push(studentId);
  return this.save();
};

studentTeamSchema.methods.removeMember = function(studentId) {
  if (!this.members.includes(studentId)) {
    throw new Error('Student is not a member');
  }
  
  if (this.leader.equals(studentId) && this.members.length > 1) {
    throw new Error('Cannot remove team leader. Transfer leadership first.');
  }
  
  this.members = this.members.filter(member => !member.equals(studentId));
  
  // If removing the last member, mark team as disbanded
  if (this.members.length === 0) {
    this.status = 'disbanded';
  }
  
  return this.save();
};

studentTeamSchema.methods.transferLeadership = function(newLeaderId) {
  if (!this.members.includes(newLeaderId)) {
    throw new Error('New leader must be a team member');
  }
  
  this.leader = newLeaderId;
  return this.save();
};

studentTeamSchema.methods.approveJoinRequest = function(requestId) {
  const request = this.joinRequests.id(requestId);
  if (!request) {
    throw new Error('Join request not found');
  }
  
  if (this.isFull) {
    throw new Error('Team is full');
  }
  
  request.status = 'approved';
  this.addMember(request.student);
  return this.save();
};

studentTeamSchema.methods.rejectJoinRequest = function(requestId) {
  const request = this.joinRequests.id(requestId);
  if (!request) {
    throw new Error('Join request not found');
  }
  
  request.status = 'rejected';
  return this.save();
};

// Static methods
studentTeamSchema.statics.findByServer = function(serverCode) {
  return this.find({ projectServer: serverCode.toUpperCase(), status: 'active' })
    .populate('members', 'firstName lastName email username')
    .populate('leader', 'firstName lastName email username')
    .sort({ createdAt: -1 });
};

studentTeamSchema.statics.findByStudent = function(studentId) {
  return this.find({ members: studentId, status: 'active' })
    .populate('members', 'firstName lastName email username')
    .populate('leader', 'firstName lastName email username')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('StudentTeam', studentTeamSchema);