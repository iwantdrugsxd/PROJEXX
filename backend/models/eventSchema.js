const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  type: {
    type: String,
    enum: ['meeting', 'deadline', 'reminder', 'presentation', 'workshop', 'other'],
    default: 'meeting'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    default: ""
  },
  isVirtual: {
    type: Boolean,
    default: false
  },
  meetingLink: {
    type: String,
    default: ""
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'creatorModel'
  },
  creatorModel: {
    type: String,
    required: true,
    enum: ['Student', 'Faculty']
  },
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'attendeeModel'
  }],
  attendeeModel: {
    type: String,
    enum: ['Student', 'Faculty'],
    default: 'Student'
  },
  reminders: [{
    type: Number, // minutes before event
    default: 15
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrenceRule: {
    type: String,
    default: ""
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes for better performance
eventSchema.index({ createdBy: 1, startDate: 1 });
eventSchema.index({ attendees: 1, startDate: 1 });
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ type: 1 });

module.exports = mongoose.model("Event", eventSchema);