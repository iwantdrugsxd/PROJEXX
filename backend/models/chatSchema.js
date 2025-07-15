const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group', 'team'],
    required: true
  },
  name: {
    type: String,
    required: function() {
      return this.type === 'group';
    }
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'participantModel'
  }],
  participantModel: {
    type: String,
    enum: ['Student', 'Faculty'],
    default: 'Student'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'creatorModel',
    required: true
  },
  creatorModel: {
    type: String,
    enum: ['Student', 'Faculty'],
    required: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

chatSchema.index({ participants: 1 });
chatSchema.index({ type: 1 });

module.exports = mongoose.model("Chat", chatSchema);