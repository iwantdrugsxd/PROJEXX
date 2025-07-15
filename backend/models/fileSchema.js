const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true,
    unique: true
  },
  path: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'uploaderModel'
  },
  uploaderModel: {
    type: String,
    required: true,
    enum: ['Student', 'Faculty']
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  description: {
    type: String,
    default: ""
  },
  category: {
    type: String,
    enum: ['assignment', 'resource', 'submission', 'feedback', 'general'],
    default: 'general'
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloaded: {
    type: Date,
    default: null
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes for better performance
fileSchema.index({ uploadedBy: 1, uploadedAt: -1 });
fileSchema.index({ taskId: 1 });
fileSchema.index({ category: 1 });
fileSchema.index({ filename: 1 });

module.exports = mongoose.model("File", fileSchema);