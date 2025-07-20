// backend/models/Submission.js
const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  // ✅ Core submission data
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  
  // ✅ Submission content
  comment: {
    type: String,
    required: true,
    trim: true,
    minlength: [10, 'Comment must be at least 10 characters'],
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  },
  
  collaborators: [{
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Invalid email format for collaborator'
    }
  }],
  
  // ✅ File references
  files: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriveFile'
  }],
  
  // ✅ Submission metadata
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'graded', 'returned', 'resubmission_required'],
    default: 'submitted',
    index: true
  },
  
  attemptNumber: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  
  isLate: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // ✅ Google Drive integration
  driveFolderId: {
    type: String,
    index: true
  },
  
  drivePermissions: [{
    email: String,
    role: {
      type: String,
      enum: ['reader', 'writer', 'commenter'],
      default: 'reader'
    },
    grantedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ Grading information
  grade: {
    type: Number,
    min: 0,
    validate: {
      validator: async function(value) {
        if (value == null) return true; // Allow null/undefined for ungraded
        
        // Get the task to check maxPoints
        const task = await mongoose.model('Task').findById(this.task);
        return task ? value <= task.maxPoints : true;
      },
      message: 'Grade cannot exceed maximum points for this task'
    }
  },
  
  feedback: {
    type: String,
    trim: true,
    maxlength: [5000, 'Feedback cannot exceed 5000 characters']
  },
  
  rubricScores: [{
    criterion: String,
    score: Number,
    maxScore: Number,
    comment: String
  }],
  
  gradedAt: Date,
  
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty'
  },
  
  // ✅ Review and approval workflow
  reviewHistory: [{
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    },
    reviewedAt: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['submitted', 'reviewed', 'graded', 'returned', 'approved', 'rejected']
    },
    comment: String
  }],
  
  // ✅ Analytics and tracking
  viewHistory: [{
    viewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'viewHistory.viewerModel'
    },
    viewerModel: {
      type: String,
      enum: ['Student', 'Faculty']
    },
    viewedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  
  downloadHistory: [{
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriveFile'
    },
    downloadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'downloadHistory.downloaderModel'
    },
    downloaderModel: {
      type: String,
      enum: ['Student', 'Faculty']
    },
    downloadedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String
  }],
  
  // ✅ System metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // ✅ Soft delete support
  deletedAt: Date,
  
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

// ✅ Indexes for performance
SubmissionSchema.index({ student: 1, task: 1 }, { unique: true });
SubmissionSchema.index({ task: 1, submittedAt: -1 });
SubmissionSchema.index({ status: 1, submittedAt: -1 });
SubmissionSchema.index({ gradedBy: 1, gradedAt: -1 });
SubmissionSchema.index({ isLate: 1, submittedAt: -1 });
SubmissionSchema.index({ deletedAt: 1 }, { sparse: true });

// ✅ Virtual fields
SubmissionSchema.virtual('isGraded').get(function() {
  return this.grade !== null && this.grade !== undefined;
});

SubmissionSchema.virtual('daysLate').get(function() {
  if (!this.isLate || !this.task?.dueDate) return 0;
  const dueDate = new Date(this.task.dueDate);
  const submittedDate = new Date(this.submittedAt);
  return Math.ceil((submittedDate - dueDate) / (1000 * 60 * 60 * 24));
});

SubmissionSchema.virtual('fileCount').get(function() {
  return this.files ? this.files.length : 0;
});

SubmissionSchema.virtual('totalFileSize').get(function() {
  if (!this.files || !Array.isArray(this.files)) return 0;
  return this.files.reduce((total, file) => {
    return total + (file.size || 0);
  }, 0);
});

// ✅ Middleware
SubmissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

SubmissionSchema.pre(/^find/, function(next) {
  // Exclude soft-deleted documents by default
  if (!this.getQuery().deletedAt) {
    this.where({ deletedAt: { $exists: false } });
  }
  next();
});

// ✅ Methods
SubmissionSchema.methods.softDelete = function(deletedBy, deleterModel) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deleterModel = deleterModel;
  return this.save();
};

SubmissionSchema.methods.restore = function() {
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  this.deleterModel = undefined;
  return this.save();
};

SubmissionSchema.methods.addView = function(viewedBy, viewerModel, ipAddress, userAgent) {
  this.viewHistory.push({
    viewedBy,
    viewerModel,
    viewedAt: new Date(),
    ipAddress,
    userAgent
  });
  return this.save();
};

SubmissionSchema.methods.addDownload = function(fileId, downloadedBy, downloaderModel, ipAddress) {
  this.downloadHistory.push({
    fileId,
    downloadedBy,
    downloaderModel,
    downloadedAt: new Date(),
    ipAddress
  });
  return this.save();
};

// ✅ Static methods
SubmissionSchema.statics.findByTaskAndStudent = function(taskId, studentId) {
  return this.findOne({ task: taskId, student: studentId });
};

SubmissionSchema.statics.getSubmissionStats = function(taskId) {
  return this.aggregate([
    { $match: { task: mongoose.Types.ObjectId(taskId) } },
    {
      $group: {
        _id: null,
        totalSubmissions: { $sum: 1 },
        gradedSubmissions: {
          $sum: { $cond: [{ $ne: ['$grade', null] }, 1, 0] }
        },
        lateSubmissions: {
          $sum: { $cond: ['$isLate', 1, 0] }
        },
        averageGrade: { $avg: '$grade' },
        averageAttempts: { $avg: '$attemptNumber' }
      }
    }
  ]);
};

module.exports = mongoose.model('Submission', SubmissionSchema);

// =============================================================================

// backend/models/DriveFile.js - ENHANCED VERSION
const mongoose = require('mongoose');

const DriveFileSchema = new mongoose.Schema({
  // ✅ Google Drive integration
  driveFileId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // ✅ File metadata
  originalName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [255, 'Filename cannot exceed 255 characters']
  },
  
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  
  mimeType: {
    type: String,
    required: true,
    index: true
  },
  
  size: {
    type: Number,
    required: true,
    min: 0,
    max: 52428800 // 50MB max
  },
  
  // ✅ Drive URLs
  webViewLink: String,
  webContentLink: String,
  thumbnailLink: String,
  
  // ✅ Relationships
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    index: true
  },
  
  folderId: {
    type: String,
    index: true
  },
  
  // ✅ File classification
  isImage: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isDocument: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isVideo: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isAudio: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isArchive: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // ✅ Enhanced metadata
  metadata: {
    // Image metadata
    width: Number,
    height: Number,
    format: String,
    hasAlpha: Boolean,
    
    // Optimization metadata
    originalWidth: Number,
    originalHeight: Number,
    originalSize: Number,
    optimizedSize: Number,
    compressionRatio: Number,
    
    // Document metadata
    pageCount: Number,
    wordCount: Number,
    
    // Video metadata
    duration: Number,
    bitrate: Number,
    
    // Audio metadata
    sampleRate: Number,
    channels: Number,
    
    // General metadata
    encoding: String,
    checksum: String,
    exifData: mongoose.Schema.Types.Mixed
  },
  
  // ✅ Processing status
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed', 'quarantined'],
    default: 'uploading',
    index: true
  },
  
  processingLog: [{
    stage: {
      type: String,
      enum: ['upload', 'scan', 'optimize', 'thumbnail', 'index', 'complete']
    },
    status: {
      type: String,
      enum: ['started', 'completed', 'failed', 'skipped']
    },
    startedAt: Date,
    completedAt: Date,
    error: String,
    details: mongoose.Schema.Types.Mixed
  }],
  
  // ✅ Security and compliance
  virusScanStatus: {
    type: String,
    enum: ['pending', 'clean', 'infected', 'failed', 'skipped'],
    default: 'pending',
    index: true
  },
  
  virusScanResult: {
    scanEngine: String,
    scanDate: Date,
    threats: [String],
    quarantineReason: String
  },
  
  accessPermissions: {
    public: {
      type: Boolean,
      default: false
    },
    faculty: {
      type: Boolean,
      default: true
    },
    students: {
      type: Boolean,
      default: false
    },
    allowDownload: {
      type: Boolean,
      default: true
    },
    allowPreview: {
      type: Boolean,
      default: true
    }
  },
  
  // ✅ Backup and storage
  localPath: String, // Fallback local storage path
  
  backupLocations: [{
    provider: {
      type: String,
      enum: ['google_drive', 'aws_s3', 'azure_blob', 'local']
    },
    path: String,
    backupDate: Date,
    verified: Boolean
  }],
  
  // ✅ Analytics
  downloadCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  lastAccessedAt: Date,
  
  accessHistory: [{
    accessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'accessHistory.accessorModel'
    },
    accessorModel: {
      type: String,
      enum: ['Student', 'Faculty']
    },
    accessType: {
      type: String,
      enum: ['view', 'download', 'preview']
    },
    accessedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  
  // ✅ Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // ✅ Soft delete
  deletedAt: Date,
  
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'deleterModel'
  },
  
  deleterModel: {
    type: String,
    enum: ['Student', 'Faculty', 'System']
  },
  
  deletionReason: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ Indexes for performance
DriveFileSchema.index({ taskId: 1, uploadedBy: 1 });
DriveFileSchema.index({ submissionId: 1 });
DriveFileSchema.index({ status: 1, createdAt: -1 });
DriveFileSchema.index({ virusScanStatus: 1 });
DriveFileSchema.index({ mimeType: 1, isImage: 1 });
DriveFileSchema.index({ size: 1 });
DriveFileSchema.index({ deletedAt: 1 }, { sparse: true });

// ✅ Virtual fields
DriveFileSchema.virtual('fileExtension').get(function() {
  return this.originalName ? this.originalName.split('.').pop().toLowerCase() : '';
});

DriveFileSchema.virtual('formattedSize').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

DriveFileSchema.virtual('isProcessed').get(function() {
  return this.status === 'completed';
});

DriveFileSchema.virtual('isSafe').get(function() {
  return this.virusScanStatus === 'clean' || this.virusScanStatus === 'skipped';
});

// ✅ Middleware
DriveFileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-classify file types
  if (this.mimeType) {
    this.isImage = this.mimeType.startsWith('image/');
    this.isDocument = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(this.mimeType);
    this.isVideo = this.mimeType.startsWith('video/');
    this.isAudio = this.mimeType.startsWith('audio/');
    this.isArchive = ['application/zip', 'application/x-rar-compressed'].includes(this.mimeType);
  }
  
  next();
});

DriveFileSchema.pre(/^find/, function(next) {
  // Exclude soft-deleted files by default
  if (!this.getQuery().deletedAt) {
    this.where({ deletedAt: { $exists: false } });
  }
  next();
});

// ✅ Methods
DriveFileSchema.methods.softDelete = function(deletedBy, deleterModel, reason) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deleterModel = deleterModel;
  this.deletionReason = reason;
  return this.save();
};

DriveFileSchema.methods.addAccess = function(accessedBy, accessorModel, accessType, ipAddress, userAgent) {
  this.accessHistory.push({
    accessedBy,
    accessorModel,
    accessType,
    accessedAt: new Date(),
    ipAddress,
    userAgent
  });
  
  this.lastAccessedAt = new Date();
  
  if (accessType === 'download') {
    this.downloadCount++;
  } else if (accessType === 'view' || accessType === 'preview') {
    this.viewCount++;
  }
  
  return this.save();
};

DriveFileSchema.methods.updateProcessingStatus = function(stage, status, details, error) {
  const logEntry = {
    stage,
    status,
    startedAt: status === 'started' ? new Date() : undefined,
    completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
    details,
    error
  };
  
  this.processingLog.push(logEntry);
  
  if (stage === 'complete' && status === 'completed') {
    this.status = 'completed';
  } else if (status === 'failed') {
    this.status = 'failed';
  }
  
  return this.save();
};

// ✅ Static methods
DriveFileSchema.statics.findBySubmission = function(submissionId) {
  return this.find({ submissionId });
};

DriveFileSchema.statics.findByTask = function(taskId) {
  return this.find({ taskId });
};

DriveFileSchema.statics.getStorageStats = function() {
  return this.aggregate([
    { $match: { deletedAt: { $exists: false } } },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$size' },
        imageFiles: { $sum: { $cond: ['$isImage', 1, 0] } },
        documentFiles: { $sum: { $cond: ['$isDocument', 1, 0] } },
        videoFiles: { $sum: { $cond: ['$isVideo', 1, 0] } },
        audioFiles: { $sum: { $cond: ['$isAudio', 1, 0] } },
        archiveFiles: { $sum: { $cond: ['$isArchive', 1, 0] } },
        completedFiles: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        failedFiles: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
      }
    }
  ]);
};

module.exports = mongoose.model('DriveFile', DriveFileSchema);

// =============================================================================

// backend/models/taskSchema.js - ENHANCED VERSION
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  // ✅ Basic task information
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters'],
    index: true
  },
  
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    maxlength: [5000, 'Task description cannot exceed 5000 characters']
  },
  
  instructions: {
    type: String,
    trim: true,
    maxlength: [10000, 'Task instructions cannot exceed 10000 characters']
  },
  
  // ✅ Task metadata
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectServer',
    required: true,
    index: true
  },
  
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true
  }],
  
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
    index: true
  },
  
  // ✅ Scheduling and deadlines
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    index: true,
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Due date must be in the future'
    }
  },
  
  publishedAt: {
    type: Date,
    default: Date.now
  },
  
  startDate: {
    type: Date,
    default: Date.now
  },
  
  // ✅ Grading configuration
  maxPoints: {
    type: Number,
    required: [true, 'Maximum points is required'],
    min: [1, 'Maximum points must be at least 1'],
    max: [1000, 'Maximum points cannot exceed 1000']
  },
  
  gradingRubric: [{
    criterion: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    maxPoints: {
      type: Number,
      required: true,
      min: 0
    },
    levels: [{
      name: String,
      description: String,
      points: Number
    }]
  }],
  
  passingGrade: {
    type: Number,
    default: function() {
      return Math.ceil(this.maxPoints * 0.6); // 60% by default
    }
  },
  
  // ✅ Submission settings
  allowFileUpload: {
    type: Boolean,
    default: true
  },
  
  allowedFileTypes: [{
    type: String,
    enum: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'mp3', 'zip', 'rar'],
    default: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png']
  }],
  
  maxFileSize: {
    type: Number,
    default: 10485760, // 10MB in bytes
    max: 52428800 // 50MB max
  },
  
  maxFiles: {
    type: Number,
    default: 5,
    min: 1,
    max: 20
  },
  
  allowLateSubmissions: {
    type: Boolean,
    default: false
  },
  
  latePenalty: {
    enabled: {
      type: Boolean,
      default: false
    },
    penaltyPerDay: {
      type: Number,
      default: 5, // 5% per day
      min: 0,
      max: 100
    },
    maxLateDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 30
    }
  },
  
  maxAttempts: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  
  // ✅ Enhanced submissions tracking
  submissions: [{
    id: String,
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
      enum: ['submitted', 'under_review', 'graded', 'returned'],
      default: 'submitted'
    },
    comment: {
      type: String,
      maxlength: [2000, 'Submission comment cannot exceed 2000 characters']
    },
    files: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimetype: String,
      driveFileId: String
    }],
    collaborators: [String],
    attemptNumber: {
      type: Number,
      default: 1
    },
    isLate: {
      type: Boolean,
      default: false
    },
    grade: Number,
    feedback: String,
    gradedAt: Date,
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    }
  }],
  
  // ✅ Task status and workflow
  status: {
    type: String,
    enum: ['draft', 'published', 'active', 'completed', 'archived', 'cancelled'],
    default: 'draft',
    index: true
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  
  category: {
    type: String,
    enum: ['assignment', 'project', 'quiz', 'exam', 'presentation', 'lab', 'research'],
    default: 'assignment',
    index: true
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // ✅ Resources and attachments
  resources: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    url: String,
    description: String,
    type: {
      type: String,
      enum: ['link', 'document', 'video', 'reference', 'template'],
      default: 'link'
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriveFile'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriveFile'
  }],
  
  // ✅ Collaboration and communication
  discussions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion'
  }],
  
  announcements: [{
    title: String,
    content: String,
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    },
    postedAt: {
      type: Date,
      default: Date.now
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    readBy: [{
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
      },
      readAt: Date
    }]
  }],
  
  // ✅ Analytics and insights
  analytics: {
    totalViews: {
      type: Number,
      default: 0
    },
    uniqueViews: {
      type: Number,
      default: 0
    },
    submissionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    averageGrade: Number,
    averageCompletionTime: Number, // in hours
    gradeDistribution: {
      a: { type: Number, default: 0 },
      b: { type: Number, default: 0 },
      c: { type: Number, default: 0 },
      d: { type: Number, default: 0 },
      f: { type: Number, default: 0 }
    }
  },
  
  // ✅ Automation and AI
  autoGrading: {
    enabled: {
      type: Boolean,
      default: false
    },
    criteria: [{
      name: String,
      points: Number,
      description: String,
      automated: Boolean
    }],
    plagiarismCheck: {
      enabled: {
        type: Boolean,
        default: true
      },
      threshold: {
        type: Number,
        default: 15,
        min: 0,
        max: 100
      }
    }
  },
  
  // ✅ Visibility and access control
  isVisible: {
    type: Boolean,
    default: true,
    index: true
  },
  
  accessLevel: {
    type: String,
    enum: ['public', 'enrolled_only', 'team_only', 'private'],
    default: 'enrolled_only'
  },
  
  // ✅ Timestamps and versioning
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  archivedAt: Date,
  
  version: {
    type: Number,
    default: 1
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ Comprehensive indexes
taskSchema.index({ server: 1, createdAt: -1 });
taskSchema.index({ teams: 1, dueDate: 1 });
taskSchema.index({ faculty: 1, status: 1 });
taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ 'submissions.student': 1 });
taskSchema.index({ category: 1, priority: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ isVisible: 1, publishedAt: -1 });

// ✅ Virtual fields
taskSchema.virtual('isOverdue').get(function() {
  return new Date() > this.dueDate && this.status === 'active';
});

taskSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  return Math.max(0, due - now);
});

taskSchema.virtual('submissionCount').get(function() {
  return this.submissions ? this.submissions.length : 0;
});

taskSchema.virtual('gradedSubmissionCount').get(function() {
  return this.submissions ? this.submissions.filter(s => s.grade !== null && s.grade !== undefined).length : 0;
});

taskSchema.virtual('lateSubmissionCount').get(function() {
  return this.submissions ? this.submissions.filter(s => s.isLate).length : 0;
});

taskSchema.virtual('averageSubmissionGrade').get(function() {
  if (!this.submissions || this.submissions.length === 0) return null;
  const gradedSubmissions = this.submissions.filter(s => s.grade !== null && s.grade !== undefined);
  if (gradedSubmissions.length === 0) return null;
  const total = gradedSubmissions.reduce((sum, s) => sum + s.grade, 0);
  return Math.round((total / gradedSubmissions.length) * 100) / 100;
});

// ✅ Middleware
taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-calculate submission rate
  if (this.teams && this.teams.length > 0) {
    // This would need to be calculated properly with team member counts
    // For now, just set it based on submissions vs expected submissions
    const expectedSubmissions = this.teams.length; // Simplified
    const actualSubmissions = this.submissions ? this.submissions.length : 0;
    this.analytics.submissionRate = Math.min(100, Math.round((actualSubmissions / expectedSubmissions) * 100));
  }
  
  // Auto-calculate average grade
  if (this.submissions && this.submissions.length > 0) {
    const gradedSubmissions = this.submissions.filter(s => s.grade !== null && s.grade !== undefined);
    if (gradedSubmissions.length > 0) {
      const total = gradedSubmissions.reduce((sum, s) => sum + s.grade, 0);
      this.analytics.averageGrade = Math.round((total / gradedSubmissions.length) * 100) / 100;
    }
  }
  
  next();
});

// ✅ Methods
taskSchema.methods.addSubmission = function(submissionData) {
  // Remove existing submission from same student if exists
  this.submissions = this.submissions.filter(s => s.student.toString() !== submissionData.student.toString());
  this.submissions.push(submissionData);
  return this.save();
};

taskSchema.methods.updateSubmissionGrade = function(studentId, grade, feedback, gradedBy) {
  const submission = this.submissions.find(s => s.student.toString() === studentId.toString());
  if (submission) {
    submission.grade = grade;
    submission.feedback = feedback;
    submission.gradedAt = new Date();
    submission.gradedBy = gradedBy;
    submission.status = 'graded';
  }
  return this.save();
};

taskSchema.methods.getSubmissionByStudent = function(studentId) {
  return this.submissions.find(s => s.student.toString() === studentId.toString());
};

// ✅ Static methods
taskSchema.statics.findActiveByServer = function(serverId) {
  return this.find({ 
    server: serverId, 
    status: 'active',
    isVisible: true,
    dueDate: { $gte: new Date() }
  }).sort({ dueDate: 1 });
};

taskSchema.statics.findOverdueTasks = function() {
  return this.find({
    status: 'active',
    dueDate: { $lt: new Date() }
  });
};

taskSchema.statics.getTaskStats = function(serverId) {
  return this.aggregate([
    { $match: { server: mongoose.Types.ObjectId(serverId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        averageGrade: { $avg: '$analytics.averageGrade' },
        totalSubmissions: { $sum: { $size: '$submissions' } }
      }
    }
  ]);
};

module.exports = mongoose.model('Task', taskSchema);