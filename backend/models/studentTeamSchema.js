// backend/models/studentTeamSchema.js
const mongoose = require("mongoose");

const studentTeamSchema = new mongoose.Schema({
 teamId: [{
  type: mongoose.Schema.Types.ObjectId,
  unique: true,
  default: function() {
    return new mongoose.Types.ObjectId();
  }
}],
 name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: "",
    trim: true
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    }
  ],
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  projectServer: {
    type: String,
    ref: "ProjectServer",
    required: true,
  },
  teamCode: {
    type: String,
    unique: true,
    default: function() {
      return "TEAM-" + Math.random().toString(36).substr(2, 8).toUpperCase();
    }
  },
  maxMembers: {
    type: Number,
    default: 6,
    min: 2,
    max: 10
  },
  status: {
    type: String,
    enum: ["active", "inactive", "completed"],
    default: "active"
  },
  settings: {
    isPublic: { type: Boolean, default: true },
    allowInvites: { type: Boolean, default: true },
    autoAcceptMembers: { type: Boolean, default: false }
  },
  stats: {
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    averageProgress: { type: Number, default: 0 }
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
studentTeamSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for member count
studentTeamSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for completion rate
studentTeamSchema.virtual('completionRate').get(function() {
  if (this.stats.totalTasks === 0) return 0;
  return Math.round((this.stats.completedTasks / this.stats.totalTasks) * 100);
});

// Ensure virtual fields are serialized
studentTeamSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model("StudentTeam", studentTeamSchema);