const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
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
  files: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriveFile'
  }],
  comment: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  collaborators: [String], // Email addresses
  driveFolderId: {
    type: String,
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'reviewed', 'graded'],
    default: 'draft',
    index: true
  },
  attempt: {
    type: Number,
    default: 1
  },
  isLate: {
    type: Boolean,
    default: false,
    index: true
  },
  grade: {
    score: Number,
    maxScore: Number,
    feedback: String,
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    },
    gradedAt: Date
  },
  ipAddress: String,
  userAgent: String
});

// Compound indexes for faster queries
SubmissionSchema.index({ task: 1, student: 1 }, { unique: true });
SubmissionSchema.index({ task: 1, submittedAt: -1 });
SubmissionSchema.index({ student: 1, submittedAt: -1 });

module.exports = mongoose.model('Submission', SubmissionSchema);