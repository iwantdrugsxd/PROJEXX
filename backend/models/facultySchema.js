// backend/models/facultySchema.js
const mongoose = require("mongoose");

const facultySchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    default: function() {
      return "FAC" + Date.now().toString().slice(-8);
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
    default: 'faculty'
  },
  department: {
    type: String,
    default: "",
    trim: true
  },
  designation: {
    type: String,
    default: "",
    trim: true
  },
  profile: {
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    specialization: [{ type: String }],
    qualifications: [{ type: String }]
  },
  projectServers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectServer"
    }
  ],
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
facultySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for full name
facultySchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
facultySchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model("Faculty", facultySchema);