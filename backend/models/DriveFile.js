const mongoose = require('mongoose');

const DriveFileSchema = new mongoose.Schema({
  // Google Drive specific fields
  driveFileId: {
    type: String,
    required: [true, 'Drive file ID is required'],
    unique: true,
    trim: true,
    index: true
  },
  
  // File information
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true,
    maxlength: [255, 'Filename cannot exceed 255 characters']
  },
  
  fileName: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true,
    maxlength: [255, 'Filename cannot exceed 255 characters']
  },
  
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
    trim: true,
    maxlength: [100, 'MIME type cannot exceed 100 characters']
  },
  
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative'],
    max: [500 * 1024 * 1024, 'File size cannot exceed 500MB']
  },
  
  // Google Drive links
  webViewLink: {
    type: String,
    trim: true,
    match: [/^https:\/\/drive\.google\.com\//, 'Invalid Google Drive view link']
  },
  
  webContentLink: {
    type: String,
    trim: true,
    match: [/^https:\/\/drive\.google\.com\//, 'Invalid Google Drive content link']
  },
  
  thumbnailLink: {
    type: String,
    trim: true,
    match: [/^https:\/\//, 'Invalid thumbnail link']
  },
  
  // Local backup path (if applicable)
  localPath: {
    type: String,
    trim: true
  },
  
  // Ownership and associations
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Uploader is required'],
    refPath: 'uploaderModel',
    index: true
  },
  
  uploaderModel: {
    type: String,
    required: [true, 'Uploader model is required'],
    enum: ['Student', 'Faculty']
  },
  
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: [true, 'Task ID is required'],
    index: true
  },
  
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    index: true
  },
  
  // Folder organization
  folderId: {
    type: String,
    trim: true,
    index: true
  },
  
  folderPath: {
    type: String,
    trim: true,
    maxlength: [500, 'Folder path cannot exceed 500 characters']
  },
  
  // File type classification
  isImage: {
    type: Boolean,
    default: false
  },
  
  isDocument: {
    type: Boolean,
    default: false
  },
  
  isArchive: {
    type: Boolean,
    default: false
  },
  
  // Image metadata (if applicable)
  metadata: {
    width: {
      type: Number,
      min: 0
    },
    height: {
      type: Number,
      min: 0
    },
    format: {
      type: String,
      trim: true,
      uppercase: true
    },
    hasAlpha: Boolean,
    colorSpace: String,
    compression: String
  },
  
  // Processing status
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed', 'deleted'],
    default: 'uploading',
    index: true
  },
  
  processingError: {
    type: String,
    trim: true,
    maxlength: [500, 'Processing error cannot exceed 500 characters']
  },
  
  // Access tracking
  downloadCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  lastDownloaded: {
    type: Date,
    index: true
  },
  
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  lastViewed: {
    type: Date,
    index: true
  },
  
  // Security and permissions
  isPublic: {
    type: Boolean,
    default: false
  },
  
  accessLevel: {
    type: String,
    enum: ['private', 'team', 'public', 'faculty_only'],
    default: 'team'
  },
  
  // File verification
  checksum: {
    type: String,
    trim: true,
    minlength: [32, 'Checksum must be at least 32 characters'],
    maxlength: [128, 'Checksum cannot exceed 128 characters']
  },
  
  // Timestamps
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  deletedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
DriveFileSchema.index({ taskId: 1, uploadedBy: 1 });
DriveFileSchema.index({ submissionId: 1, status: 1 });
DriveFileSchema.index({ folderId: 1, uploadedAt: -1 });
DriveFileSchema.index({ uploadedBy: 1, uploadedAt: -1 });
DriveFileSchema.index({ status: 1, createdAt: -1 });
DriveFileSchema.index({ mimeType: 1, isImage: 1 });

// Virtual fields
DriveFileSchema.virtual('fileSizeMB').get(function() {
  return Math.round((this.size / (1024 * 1024)) * 100) / 100;
});

DriveFileSchema.virtual('fileExtension').get(function() {
  if (!this.originalName) return '';
  const parts = this.originalName.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
});

DriveFileSchema.virtual('isDeleted').get(function() {
  return !!this.deletedAt;
});

DriveFileSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
DriveFileSchema.pre('save', function(next) {
  // Update timestamp
  this.updatedAt = new Date();
  
  // Set file type flags based on MIME type
  if (this.mimeType) {
    this.isImage = this.mimeType.startsWith('image/');
    this.isDocument = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/rtf'
    ].includes(this.mimeType);
    this.isArchive = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/x-7z-compressed'
    ].includes(this.mimeType);
  }
  
  next();
});

// Instance methods
DriveFileSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  this.lastDownloaded = new Date();
  return this.save();
};

DriveFileSchema.methods.incrementView = function() {
  this.viewCount += 1;
  this.lastViewed = new Date();
  return this.save();
};

DriveFileSchema.methods.markAsDeleted = function() {
  this.deletedAt = new Date();
  this.status = 'deleted';
  return this.save();
};

DriveFileSchema.methods.canBeAccessedBy = function(userId, userRole) {
  // Owner can always access
  if (this.uploadedBy.toString() === userId.toString()) {
    return true;
  }
  
  // Faculty can access all files
  if (userRole === 'faculty' || userRole === 'admin') {
    return true;
  }
  
  // Check access level
  switch (this.accessLevel) {
    case 'public':
      return true;
    case 'team':
      // Would need to check if user is in the same team
      return true; // Simplified for now
    case 'faculty_only':
      return userRole === 'faculty';
    case 'private':
    default:
      return false;
  }
};

// Static methods
DriveFileSchema.statics.findByTask = function(taskId) {
  return this.find({ 
    taskId, 
    status: { $ne: 'deleted' },
    deletedAt: { $exists: false }
  }).sort({ uploadedAt: -1 });
};

DriveFileSchema.statics.findBySubmission = function(submissionId) {
  return this.find({ 
    submissionId,
    status: { $ne: 'deleted' },
    deletedAt: { $exists: false }
  }).sort({ uploadedAt: -1 });
};

DriveFileSchema.statics.findByUploader = function(uploaderId) {
  return this.find({ 
    uploadedBy: uploaderId,
    status: { $ne: 'deleted' },
    deletedAt: { $exists: false }
  }).sort({ uploadedAt: -1 });
};

DriveFileSchema.statics.getStorageStats = function() {
  return this.aggregate([
    { $match: { status: { $ne: 'deleted' }, deletedAt: { $exists: false } } },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgSize: { $avg: '$size' },
        totalImages: { $sum: { $cond: ['$isImage', 1, 0] } },
        totalDocuments: { $sum: { $cond: ['$isDocument', 1, 0] } },
        totalArchives: { $sum: { $cond: ['$isArchive', 1, 0] } }
      }
    }
  ]);
};

module.exports = mongoose.model('DriveFile', DriveFileSchema);