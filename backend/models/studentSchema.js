// backend/models/studentSchema.js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    default: function() {
      return "STU" + Date.now().toString().slice(-8);
    }
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'student'
  },
  joinedTeams: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentTeam"
    }
  ],
  joinedServers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectServer"
    }
  ],
  profile: {
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    skills: [{ type: String }],
    interests: [{ type: String }]
  },
  performance: {
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
studentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
studentSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model("Student", studentSchema);