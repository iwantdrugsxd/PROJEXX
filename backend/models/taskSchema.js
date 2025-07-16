const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  // Assignment type and references
  assignmentType: {
    type: String,
    enum: ['team', 'individual'],
    required: true,
    default: 'team'
  },

  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    minlength: [3, 'Task title must be at least 3 characters long'],
    maxlength: [200, 'Task title cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    minlength: [10, 'Task description must be at least 10 characters long'],
    maxlength: [2000, 'Task description cannot exceed 2000 characters']
  },

  // References to related entities
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectServer',
    required: [true, 'Server reference is required']
  },

  // ✅ FIXED: Single team field (removed duplicate)
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentTeam',
    required: function() {
      return this.assignmentType === 'team';
    }
  },

  // For individual assignments
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student', 
    required: function() {
      return this.assignmentType === 'individual';
    }
  },

  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: [true, 'Faculty reference is required']
  },

  // Task timing and grading
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'Due date must be in the future'
    }
  },

  maxPoints: {
    type: Number,
    default: 100,
    min: [1, 'Maximum points must be at least 1'],
    max: [1000, 'Maximum points cannot exceed 1000']
  },

  // Task status and metadata
  status: {
    type: String,
    enum: ['active', 'archived', 'draft'],
    default: 'active'
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // ✅ UPDATED: Submission tracking with multiple files support
  submissions: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    
    submittedAt: {
      type: Date,
      default: Date.now
    },
    
    status: {
      type: String,
      enum: ['submitted', 'graded', 'returned'],
      default: 'submitted'
    },
    
    comment: {
      type: String,
      maxlength: [1000, 'Submission comment cannot exceed 1000 characters'],
      trim: true
    },
    
    // ✅ UPDATED: Support multiple files instead of single file
    files: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimetype: String
    }],
    
    // ✅ NEW: Collaborators support
    collaborators: [{
      type: String, // Email addresses
      trim: true,
      lowercase: true
    }],
    
    // Grading information
    grade: {
      type: Number,
      min: 0,
      validate: {
        validator: function(v) {
          // Grade cannot exceed maxPoints of the parent task
          return v <= this.parent().maxPoints;
        },
        message: 'Grade cannot exceed maximum points for this task'
      }
    },
    
    feedback: {
      type: String,
      maxlength: [2000, 'Feedback cannot exceed 2000 characters'],
      trim: true
    },
    
    gradedAt: Date,
    
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    },

    // Submission attempt tracking
    attemptNumber: {
      type: Number,
      default: 1,
      min: 1
    },

    // Late submission flag
    isLate: {
      type: Boolean,
      default: false
    }
  }],

  // Task configuration
  allowLateSubmissions: {
    type: Boolean,
    default: false
  },

  maxAttempts: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },

  // File upload settings
  allowFileUpload: {
    type: Boolean,
    default: true
  },

  allowedFileTypes: [{
    type: String,
    enum: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'zip', 'rar']
  }],

  maxFileSize: {
    type: Number,
    default: 10485760, // 10MB in bytes
    max: 52428800 // 50MB max
  },

  // Additional task resources
  resources: [{
    title: String,
    url: String,
    description: String,
    type: {
      type: String,
      enum: ['link', 'document', 'video', 'reference']
    }
  }],

  // Task visibility and access
  isVisible: {
    type: Boolean,
    default: true
  },

  publishedAt: {
    type: Date,
    default: Date.now
  },

  // Automatic grading (for future use)
  autoGrading: {
    enabled: {
      type: Boolean,
      default: false
    },
    criteria: [{
      name: String,
      points: Number,
      description: String
    }]
  },

  // Task analytics
  analytics: {
    totalViews: {
      type: Number,
      default: 0
    },
    averageCompletionTime: Number, // in minutes
    submissionRate: Number // percentage
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },

  archivedAt: Date
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
taskSchema.index({ server: 1, createdAt: -1 });
taskSchema.index({ team: 1, dueDate: 1 });
taskSchema.index({ faculty: 1, createdAt: -1 });
taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ 'submissions.student': 1 });

// Virtual fields
taskSchema.virtual('isOverdue').get(function() {
  return new Date() > this.dueDate;
});

taskSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  return Math.max(0, due - now);
});

taskSchema.virtual('submissionCount').get(function() {
  return this.submissions.length;
});

taskSchema.virtual('pendingSubmissions').get(function() {
  return this.submissions.filter(sub => sub.status === 'submitted').length;
});

taskSchema.virtual('gradedSubmissions').get(function() {
  return this.submissions.filter(sub => sub.status === 'graded').length;
});

taskSchema.virtual('averageGrade').get(function() {
  const gradedSubs = this.submissions.filter(sub => sub.grade !== undefined);
  if (gradedSubs.length === 0) return null;
  
  const total = gradedSubs.reduce((sum, sub) => sum + sub.grade, 0);
  return Math.round((total / gradedSubs.length) * 100) / 100;
});

// Pre-save middleware
taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set late submission flags
  this.submissions.forEach(submission => {
    if (submission.submittedAt > this.dueDate) {
      submission.isLate = true;
    }
  });
  
  next();
});

// Pre-save middleware to validate submissions
taskSchema.pre('save', function(next) {
  const errors = [];
  
  // Validate that students don't submit multiple times (unless allowed)
  const studentSubmissions = {};
  this.submissions.forEach(submission => {
    const studentId = submission.student.toString();
    if (studentSubmissions[studentId]) {
      if (this.maxAttempts === 1) {
        errors.push(`Student ${studentId} has already submitted this task`);
      } else if (studentSubmissions[studentId] >= this.maxAttempts) {
        errors.push(`Student ${studentId} has exceeded maximum attempts (${this.maxAttempts})`);
      }
    }
    studentSubmissions[studentId] = (studentSubmissions[studentId] || 0) + 1;
  });
  
  if (errors.length > 0) {
    return next(new Error(errors.join(', ')));
  }
  
  next();
});

// Instance methods
taskSchema.methods.getSubmissionByStudent = function(studentId) {
  return this.submissions.find(sub => sub.student.toString() === studentId.toString());
};

taskSchema.methods.hasStudentSubmitted = function(studentId) {
  return this.submissions.some(sub => sub.student.toString() === studentId.toString());
};

taskSchema.methods.canStudentSubmit = function(studentId) {
  const studentSubs = this.submissions.filter(sub => sub.student.toString() === studentId.toString());
  return studentSubs.length < this.maxAttempts && (this.allowLateSubmissions || !this.isOverdue);
};

taskSchema.methods.addSubmission = function(submissionData) {
  const submission = {
    ...submissionData,
    submittedAt: new Date(),
    isLate: new Date() > this.dueDate
  };
  
  this.submissions.push(submission);
  return submission;
};

taskSchema.methods.gradeSubmission = function(studentId, grade, feedback, gradedBy) {
  const submission = this.getSubmissionByStudent(studentId);
  if (!submission) {
    throw new Error('Submission not found');
  }
  
  if (grade > this.maxPoints) {
    throw new Error('Grade cannot exceed maximum points');
  }
  
  submission.grade = grade;
  submission.feedback = feedback || '';
  submission.status = 'graded';
  submission.gradedAt = new Date();
  submission.gradedBy = gradedBy;
  
  return submission;
};

// Static methods
taskSchema.statics.findByServer = function(serverId) {
  return this.find({ server: serverId })
    .populate('faculty', 'firstName lastName email')
    .populate('server', 'title code')
    .populate('team', 'name members')
    .sort({ createdAt: -1 });
};

taskSchema.statics.findByTeam = function(teamId) {
  return this.find({ team: teamId })
    .populate('faculty', 'firstName lastName email')
    .populate('server', 'title code')
    .populate('team', 'name members')
    .sort({ createdAt: -1 });
};

taskSchema.statics.findByFaculty = function(facultyId) {
  return this.find({ faculty: facultyId })
    .populate('server', 'title code')
    .populate('team', 'name members')
    .sort({ createdAt: -1 });
};

taskSchema.statics.findOverdueTasks = function() {
  return this.find({ 
    dueDate: { $lt: new Date() },
    status: 'active'
  });
};

// Export the model
module.exports = mongoose.model('Task', taskSchema);