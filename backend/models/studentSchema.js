// backend/models/studentSchema.js - Enhanced with Authentication Methods
const mongoose = require("mongoose");
// const bcrypt = require('bcryptjs');

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
    interests: [{ type: String }],
    socialLinks: {
      github: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      portfolio: { type: String, default: "" }
    }
  },
  performance: {
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    averageGrade: { type: Number, default: 0 },
    totalSubmissions: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  passwordResetToken: {
    type: String
  },
  emailVerificationToken: {
    type: String
  },
  department: {
    type: String,
    trim: true
  },
  enrollmentYear: {
    type: Number
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

// Pre-save middleware
studentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Instance methods
studentSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

studentSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockedUntil && this.lockedUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        lockedUntil: 1,
      },
      $set: {
        loginAttempts: 1,
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we have max attempts and we're not locked, lock the account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockedUntil: Date.now() + 2 * 60 * 60 * 1000, // Lock for 2 hours
      isLocked: true
    };
  }
  
  return this.updateOne(updates);
};

studentSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockedUntil: 1
    },
    $set: {
      isLocked: false
    }
  });
};

// Static methods
studentSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase().trim() },
      { username: { $regex: new RegExp(`^${identifier.trim()}$`, 'i') } }
    ]
  });
};

studentSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

studentSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: { $regex: new RegExp(`^${username.trim()}$`, 'i') } });
};

// Ensure virtual fields are serialized
studentSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.emailVerificationToken;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Student", studentSchema);