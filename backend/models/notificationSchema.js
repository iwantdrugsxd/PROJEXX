const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    required: true,
    enum: ['Student', 'Faculty']
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    enum: ['Student', 'Faculty', 'System']
  },
  type: {
    type: String,
    required: true,
    enum: [
      'team_created',
      'team_joined',
      'task_assigned',
      'task_submitted',
      'task_verified',
      'task_graded',
      'project_server_joined',
      'deadline_reminder',
      'system'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectServer' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentTeam' },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    submissionId: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);