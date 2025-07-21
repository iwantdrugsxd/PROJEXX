const mongoose = require('mongoose');

const projectServerSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Server code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [6, 'Server code must be at least 6 characters'],
    maxlength: [10, 'Server code cannot exceed 10 characters'],
    match: [/^[A-Z0-9]+$/, 'Server code can only contain uppercase letters and numbers'],
    index: true
  },
  
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    minlength: [3, 'Project title must be at least 3 characters'],
    maxlength: [200, 'Project title cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Project description cannot exceed 2000 characters'],
    default: ''
  },
  
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: [true, 'Faculty reference is required'],
    index: true
  },
  
  // Server settings
  settings: {
    maxTeams: {
      type: Number,
      default: 50,
      min: [1, 'Maximum teams must be at least 1'],
      max: [200, 'Maximum teams cannot exceed 200']
    },
    maxStudentsPerTeam: {
      type: Number,
      default: 5,
      min: [1, 'Maximum students per team must be at least 1'],
      max: [20, 'Maximum students per team cannot exceed 20']
    },
    allowLateSubmissions: {
      type: Boolean,
      default: false
    },
    autoGrading: {
      type: Boolean,
      default: false
    },
    requireApproval: {
      type: Boolean,
      default: true
    }
  },
  
  // Server status
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived', 'maintenance'],
    default: 'active',
    index: true
  },
  
  // Statistics
  stats: {
    totalTeams: {
      type: Number,
      default: 0,
      min: 0
    },
    totalStudents: {
      type: Number,
      default: 0,
      min: 0
    },
    totalTasks: {
      type: Number,
      default: 0,
      min: 0
    },
    activeTasks: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Dates
  startDate: {
    type: Date,
    default: Date.now
  },
  
  endDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  
  // Additional fields
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  
  visibility: {
    type: String,
    enum: ['public', 'private', 'departmental'],
    default: 'departmental'
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

// Indexes for performance
projectServerSchema.index({ faculty: 1, status: 1 });
projectServerSchema.index({ status: 1, createdAt: -1 });
projectServerSchema.index({ code: 1 });
projectServerSchema.index({ title: 'text', description: 'text' });

// Virtual fields
projectServerSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

projectServerSchema.virtual('teams', {
  ref: 'StudentTeam',
  localField: 'code',
  foreignField: 'projectServer'
});

projectServerSchema.virtual('tasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'server'
});

// Pre-save middleware
projectServerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods
projectServerSchema.statics.findByFaculty = function(facultyId) {
  return this.find({ faculty: facultyId })
    .populate('faculty', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

projectServerSchema.statics.findActiveServers = function() {
  return this.find({ status: 'active' })
    .populate('faculty', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('ProjectServer', projectServerSchema);