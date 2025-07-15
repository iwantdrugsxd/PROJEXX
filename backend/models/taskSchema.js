// backend/models/taskSchema.js
const mongoose = require("mongoose");

 const submissionSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    submittedAt: { type: Date, default: Date.now },
    fileName: String,
    filePath: String,
    fileSize: Number,
    comment: String,
    status: { type: String, enum: ['submitted', 'graded', 'returned'], default: 'submitted' },
    grade: { type: Number, min: 0, max: 100 },
    feedback: String,
    gradedAt: Date
  });

  const taskSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    server: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectServer', required: true },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
    dueDate: { type: Date, required: true },
    maxPoints: { type: Number, default: 100 },
    submissions: [submissionSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });

module.exports = mongoose.model("Task", taskSchema);