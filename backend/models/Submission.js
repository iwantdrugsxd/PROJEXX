const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  // Core submission information
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student reference is required'],
    index: true
  },
  
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: [true, 'Task reference is required'],
    index: true
  },
  
  // Submission content
  content: {
    text: {
      type: String,
      trim: true,
      maxlength: [10000, 'Submission text cannot exceed 10000 characters']
    },
    
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Submission comment cannot exceed 1000 characters'],
      default: ''
    },
    
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Submission notes cannot exceed 2000 characters'],
      default: ''
    }
  },
  
  // File attachments
  files: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriveFile'
  }],
  
  // Collaboration information
  collaborators: [{
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Invalid collaborator email']
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Collaborator name cannot exceed 100 characters']
    },
    role: {
      type: String,
      trim: true,
      maxlength: [50, 'Collaborator role cannot exceed 50 characters']
    }
  }],
  
  // Submission metadata
  attemptNumber: {
    type: Number,
    default: 1,
    min: [1, 'Attempt number must be at least 1'],
    max: [10, 'Attempt number cannot exceed 10']
  },
  
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'graded', 'returned', 'resubmission_required'],
    default: 'submitted',
    index: true
  },
  
  // Timing information
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  isLate: {
    type: Boolean,
    default: false,
    index: true
  },
  
  daysLate: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Grading information
  grade: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return v === null || v === undefined || (this.task && v <= this.task.maxPoints);
      },
      message: 'Grade cannot exceed maximum points for this task'
    }
  },
  
  feedback: {
    type: String,
    trim: true,
    maxlength: [5000, 'Feedback cannot exceed 5000 characters'],
    default: ''
  },
  
  rubricScores: [{
    criterion: {
      type: String,
      required: true,
      trim: true
    },
    score: {
      type: Number,
      required: true,
      min: 0
    },
    maxScore: {
      type: Number,
      required: true,
      min: 1
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Rubric comment cannot exceed 500 characters']
    }
  }],
  
  gradedAt: {
    type: Date,
    index: true
  },
  
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    index: true
  },
  
  // Review and approval workflow
  reviewHistory: [{
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true
    },
    reviewedAt: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['submitted', 'reviewed', 'graded', 'returned', 'approved', 'rejected'],
      required: true
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review comment cannot exceed 1000 characters']
    },
    previousGrade: Number,
    newGrade: Number
  }],
  
  // Analytics and tracking
  viewHistory: [{
    viewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'viewHistory.viewerModel',
      required: true
    },
    viewerModel: {
      type: String,
      enum: ['Student', 'Faculty'],
      required: true
    },
    viewedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'User agent cannot exceed 500 characters']
    },
    duration: {
      type: Number,
      min: 0
    }
  }],
  
  downloadHistory: [{
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriveFile',
      required: true
    },
    downloadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'downloadHistory.downloaderModel',
      required: true
    },
    downloaderModel: {
      type: String,
      enum: ['Student', 'Faculty'],
      required: true
    },
    downloadedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: {
      type: String,
      trim: true
    }
  }],
  
  // Technical metadata
  submissionData: {
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'User agent cannot exceed 500 characters']
    },
    browserInfo: {
      name: String,
      version: String,
      platform: String
    },
    submissionSource: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    }
  },
  
  // Plagiarism and integrity
  plagiarismCheck: {
    checked: {
      type: Boolean,
      default: false
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    checkedAt: Date,
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    },
    report: {
      sources: [{
        url: String,
        similarity: Number,
        text: String
      }],
      summary: String
    }
  },
  
  // System metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Soft delete support
  deletedAt: {
    type: Date,
    index: true
  },
  
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'deleterModel'
  },
  
  deleterModel: {
    type: String,
    enum: ['Student', 'Faculty']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
SubmissionSchema.index({ student: 1, task: 1 }, { unique: true });
SubmissionSchema.index({ task: 1, submittedAt: -1 });
SubmissionSchema.index({ status: 1, submittedAt: -1 });
SubmissionSchema.index({ gradedBy: 1, gradedAt: -1 });
SubmissionSchema.index({ isLate: 1, submittedAt: -1 });
SubmissionSchema.index({ deletedAt: 1 }, { sparse: true });
SubmissionSchema.index({ 'plagiarismCheck.checked': 1, 'plagiarismCheck.score': 1 });

// Virtual fields
SubmissionSchema.virtual('isGraded').get(function() {
  return this.grade !== null && this.grade !== undefined;
});

SubmissionSchema.virtual('daysLateCalculated').get(function() {
  if (!this.isLate || !this.task?.dueDate) return 0;
  const dueDate = new Date(this.task.dueDate);
  const submittedDate = new Date(this.submittedAt);
  return Math.ceil((submittedDate - dueDate) / (1000 * 60 * 60 * 24));
});

SubmissionSchema.virtual('fileCount').get(function() {
  return this.files ? this.files.length : 0;
});

SubmissionSchema.virtual('totalRubricScore').get(function() {
  if (!this.rubricScores || this.rubricScores.length === 0) return 0;
  return this.rubricScores.reduce((total, score) => total + score.score, 0);
});

SubmissionSchema.virtual('rubricPercentage').get(function() {
  if (!this.rubricScores || this.rubricScores.length === 0) return 0;
  const totalScore = this.totalRubricScore;
  const maxScore = this.rubricScores.reduce((total, score) => total + score.maxScore, 0);
  return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
});

SubmissionSchema.virtual('timeSinceSubmission').get(function() {
  const now = new Date();
  const submitted = new Date(this.submittedAt);
  return now.getTime() - submitted.getTime();
});

SubmissionSchema.virtual('isDeleted').get(function() {
  return !!this.deletedAt;
});

// Pre-save middleware
SubmissionSchema.pre('save', async function(next) {
  // Update timestamp
  this.updatedAt = new Date();
  
  // Calculate days late if submission is late
  if (this.isLate && this.task?.dueDate) {
    const dueDate = new Date(this.task.dueDate);
    const submittedDate = new Date(this.submittedAt);
    this.daysLate = Math.max(0, Math.ceil((submittedDate - dueDate) / (1000 * 60 * 60 * 24)));
  }
  
  // Validate rubric scores if provided
  if (this.rubricScores && this.rubricScores.length > 0) {
    for (const score of this.rubricScores) {
      if (score.score > score.maxScore) {
        return next(new Error(`Rubric score ${score.score} cannot exceed maximum ${score.maxScore} for criterion ${score.criterion}`));
      }
    }
  }
  
  next();
});

// Instance methods
SubmissionSchema.methods.addFile = function(fileId) {
  if (!this.files.includes(fileId)) {
    this.files.push(fileId);
  }
  return this.save();
};

SubmissionSchema.methods.removeFile = function(fileId) {
  this.files = this.files.filter(file => !file.equals(fileId));
  return this.save();
};

SubmissionSchema.methods.addReview = function(reviewData) {
  this.reviewHistory.push({
    ...reviewData,
    reviewedAt: new Date()
  });
  return this.save();
};

SubmissionSchema.methods.recordView = function(viewerData) {
  this.viewHistory.push({
    ...viewerData,
    viewedAt: new Date()
  });
  return this.save();
};

SubmissionSchema.methods.recordDownload = function(downloadData) {
  this.downloadHistory.push({
    ...downloadData,
    downloadedAt: new Date()
  });
  return this.save();
};

SubmissionSchema.methods.markAsDeleted = function(deletedBy, deleterModel) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deleterModel = deleterModel;
  return this.save();
};

SubmissionSchema.methods.calculateGradeFromRubric = function() {
  if (!this.rubricScores || this.rubricScores.length === 0) return null;
  
  const totalScore = this.rubricScores.reduce((sum, score) => sum + score.score, 0);
  const maxScore = this.rubricScores.reduce((sum, score) => sum + score.maxScore, 0);
  
  if (maxScore === 0) return null;
  
  // Assuming the task has a maxPoints field, scale the score appropriately
  return this.task?.maxPoints ? Math.round((totalScore / maxScore) * this.task.maxPoints) : totalScore;
};

// Static methods
SubmissionSchema.statics.findByTask = function(taskId) {
  return this.find({ 
    task: taskId,
    deletedAt: { $exists: false }
  })
  .populate('student', 'firstName lastName email username')
  .populate('files')
  .sort({ submittedAt: -1 });
};

SubmissionSchema.statics.findByStudent = function(studentId) {
  return this.find({ 
    student: studentId,
    deletedAt: { $exists: false }
  })
  .populate('task', 'title dueDate maxPoints')
  .populate('files')
  .sort({ submittedAt: -1 });
};

SubmissionSchema.statics.findPendingGrading = function(facultyId) {
  return this.find({
    status: { $in: ['submitted', 'under_review'] },
    deletedAt: { $exists: false }
  })
  .populate({
    path: 'task',
    match: { faculty: facultyId },
    select: 'title dueDate maxPoints'
  })
  .populate('student', 'firstName lastName email')
  .sort({ submittedAt: 1 });
};

SubmissionSchema.statics.findLateSubmissions = function() {
  return this.find({
    isLate: true,
    deletedAt: { $exists: false }
  })
  .populate('task', 'title dueDate')
  .populate('student', 'firstName lastName email')
  .sort({ submittedAt: -1 });
};

SubmissionSchema.statics.getSubmissionStats = function(filters = {}) {
  const matchStage = { deletedAt: { $exists: false }, ...filters };
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSubmissions: { $sum: 1 },
        gradedSubmissions: { 
          $sum: { 
            $cond: [{ $ne: ['$grade', null] }, 1, 0] 
          }
        },
        lateSubmissions: { 
          $sum: { 
            $cond: ['$isLate', 1, 0] 
          }
        },
        averageGrade: { $avg: '$grade' },
        averageDaysLate: { $avg: '$daysLate' }
      }
    }
  ]);
};

module.exports = mongoose.model('Submission', SubmissionSchema);