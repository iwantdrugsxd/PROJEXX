const mongoose = require('mongoose');

const DriveFileSchema = new mongoose.Schema({
  driveFileId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  mimeType: String,
  size: Number,
  webViewLink: String,
  webContentLink: String,
  thumbnailLink: String,
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
    ref: 'Submission'
  },
  folderId: String,
  isImage: {
    type: Boolean,
    default: false
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    compressedSize: Number,
    originalWidth: Number,
    originalHeight: Number
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed'],
    default: 'uploading'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

DriveFileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
DriveFileSchema.index({ taskId: 1, uploadedBy: 1 });
DriveFileSchema.index({ submissionId: 1 });

module.exports = mongoose.model('DriveFile', DriveFileSchema);