const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  // Personal information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'First name can only contain letters and spaces']
  },
  
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'Last name can only contain letters and spaces']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    index: true
  },
  
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscore'],
    index: true
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  
  // Profile information
  profile: {
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      trim: true,
      default: ''
    },
    skills: [{
      type: String,
      trim: true,
      maxlength: [50, 'Skill name cannot exceed 50 characters']
    }],
    interests: [{
      type: String,
      trim: true,
      maxlength: [50, 'Interest cannot exceed 50 characters']
    }],
    avatar: {
      type: String,
      default: null
    },
    socialLinks: {
      github: String,
      linkedin: String,
      portfolio: String
    }
  },
  
  // Academic information
  studentId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  
  enrollmentYear: {
    type: Number,
    min: [2000, 'Invalid enrollment year'],
    max: [2030, 'Invalid enrollment year']
  },
  
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  
  // Team and server associations
  joinedTeams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentTeam'
  }],
  
  joinedServers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectServer'
  }],
  
  // Performance tracking
  performance: {
    totalTasks: {
      type: Number,
      default: 0,
      min: 0
    },
    completedTasks: {
      type: Number,
      default: 0,
      min: 0
    },
    averageGrade: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    totalSubmissions: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // System fields
  isActive: {
    type: Boolean,
    default: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  lastLogin: {
    type: Date,
    default: null
  },
  
  loginAttempts: {
    type: Number,
    default: 0,
    max: 5
  },
  
  lockedUntil: Date,
  
  // Security fields
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.emailVerificationToken;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance
studentSchema.index({ email: 1 });
studentSchema.index({ username: 1 });
studentSchema.index({ studentId: 1 }, { sparse: true });
studentSchema.index({ isActive: 1, createdAt: -1 });
studentSchema.index({ 'joinedTeams': 1 });
studentSchema.index({ 'joinedServers': 1 });

// Virtual fields
studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

studentSchema.virtual('completionRate').get(function() {
  if (this.performance.totalTasks === 0) return 0;
  return Math.round((this.performance.completedTasks / this.performance.totalTasks) * 100);
});

studentSchema.virtual('isLocked').get(function() {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
});

// Pre-save middleware
studentSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Update timestamp
  this.updatedAt = new Date();
  
  // Generate student ID if not provided
  if (!this.studentId && this.isNew) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.studentId = `STU${year}${String(count + 1).padStart(4, '0')}`;
  }
  
  next();
});

// Instance methods
studentSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

studentSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockedUntil && this.lockedUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockedUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we hit max attempts and it's not locked, lock the account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockedUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

studentSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockedUntil: 1 }
  });
};

// Static methods
studentSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  });
};

module.exports = mongoose.model('Student', studentSchema);

// ============================================
// backend/models/facultySchema.js - BULLETPROOF
// ============================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const facultySchema = new mongoose.Schema({
  // Personal information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'First name can only contain letters and spaces']
  },
  
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'Last name can only contain letters and spaces']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    index: true
  },
  
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscore'],
    index: true
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  
  // Professional information
  employeeId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  
  designation: {
    type: String,
    required: [true, 'Designation is required'],
    trim: true,
    maxlength: [100, 'Designation cannot exceed 100 characters']
  },
  
  specialization: [{
    type: String,
    trim: true,
    maxlength: [50, 'Specialization cannot exceed 50 characters']
  }],
  
  // Role and permissions
  role: {
    type: String,
    enum: ['faculty', 'admin', 'hod', 'coordinator'],
    default: 'faculty',
    required: true
  },
  
  permissions: {
    canCreateServers: {
      type: Boolean,
      default: true
    },
    canManageStudents: {
      type: Boolean,
      default: true
    },
    canViewAllData: {
      type: Boolean,
      default: false
    },
    canManageFaculty: {
      type: Boolean,
      default: false
    }
  },
  
  // Project servers created by this faculty
  createdServers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectServer'
  }],
  
  // Statistics
  stats: {
    totalServersCreated: {
      type: Number,
      default: 0,
      min: 0
    },
    totalStudentsManaged: {
      type: Number,
      default: 0,
      min: 0
    },
    totalTasksCreated: {
      type: Number,
      default: 0,
      min: 0
    },
    totalTasksGraded: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Profile information
  profile: {
    bio: {
      type: String,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
      trim: true,
      default: ''
    },
    avatar: {
      type: String,
      default: null
    },
    officeLocation: {
      type: String,
      trim: true,
      maxlength: [100, 'Office location cannot exceed 100 characters']
    },
    officeHours: {
      type: String,
      trim: true,
      maxlength: [200, 'Office hours cannot exceed 200 characters']
    },
    socialLinks: {
      linkedin: String,
      researchGate: String,
      googleScholar: String,
      website: String
    }
  },
  
  // System fields
  isActive: {
    type: Boolean,
    default: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  lastLogin: {
    type: Date,
    default: null
  },
  
  loginAttempts: {
    type: Number,
    default: 0,
    max: 5
  },
  
  lockedUntil: Date,
  
  // Security fields
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.emailVerificationToken;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance
facultySchema.index({ email: 1 });
facultySchema.index({ username: 1 });
facultySchema.index({ employeeId: 1 }, { sparse: true });
facultySchema.index({ department: 1, isActive: 1 });
facultySchema.index({ role: 1, isActive: 1 });

// Virtual fields
facultySchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

facultySchema.virtual('isLocked').get(function() {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
});

// Pre-save middleware
facultySchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Update timestamp
  this.updatedAt = new Date();
  
  // Generate employee ID if not provided
  if (!this.employeeId && this.isNew) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.employeeId = `FAC${year}${String(count + 1).padStart(4, '0')}`;
  }
  
  next();
});

// Instance methods
facultySchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

facultySchema.methods.incrementLoginAttempts = function() {
  if (this.lockedUntil && this.lockedUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockedUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockedUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

facultySchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockedUntil: 1 }
  });
};

// Static methods
facultySchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  });
};

module.exports = mongoose.model('Faculty', facultySchema);