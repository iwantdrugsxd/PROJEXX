// Task.js
const mongoose = require("mongoose");
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StudentTeam",
    required: true,
  },

  // 🔄 Polymorphic creator
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'creatorModel'
  },
  creatorModel: {
    type: String,
    required: true,
    enum: ['Faculty', 'Student']
  },

  attachments: [
    {
      filename: String,
      url: String,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student"
      },
      uploadedAt: { type: Date, default: Date.now },
    }
  ],

  comments: [
    {
      author: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "comments.authorModel",
        required: true,
      },
      authorModel: {
        type: String,
        enum: ["Faculty", "Student"],
        required: true
      },
      message: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  status: {
    type: String,
    enum: ["pending", "submitted", "approved", "rejected"],
    default: "pending"
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  completedAt: { type: Date }
});

module.exports = mongoose.model("Task", taskSchema);
