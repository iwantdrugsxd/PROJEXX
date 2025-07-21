const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  // Basic task information
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    minlength: [3, 'Task title must be at least 3 characters'],
    maxlength: [200, 'Task title cannot exceed 200 characters'],
    index: true
  },
  
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    minlength: [10, 'Task description must be at least 10 characters'],
    maxlength: [5000, 'Task description cannot exceed 5000 characters']
  },
  
  instructions: {
    type: String,
    trim: true,
    maxlength: [3000, 'Instructions cannot exceed 3000 characters'],
    default: ''
  },
  
  // Assignment type
  assignmentType: {
    type: String,
    enum: ['team', 'individual'],
    required: [true, 'Assignment type is required'],
    default: 'team',
    index: true
  },
  
  // References to related entities
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectServer',
    required: [true, 'Server reference is required'],
    index: true
  },
  
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentTeam',
    required: function() {
      return this.assignmentType === 'team';
    },
    index: true
  },
  
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: function() {
      return this.assignmentType === 'individual';
    },
    index: true
  },
  
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: [true, 'Faculty reference is required'],
    index: true
  },
  
  // Task timing and grading
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'Due date must be in the future'
    },
    index: true
  },
  
  createdDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  maxPoints: {
    type: Number,
    default: 100,
    min: [1, 'Maximum points must be at least 1'],
    max: [1000, 'Maximum points cannot exceed 1000']
  },
  
  // Task configuration
  allowLateSubmissions: {
    type: Boolean,
    default: false
  },
  
  maxAttempts: {
    type: Number,
    default: 1,
    min: [1, 'Maximum attempts must be at least 1'],
    max: [10, 'Maximum attempts cannot exceed 10']
  },
  
  allowFileUpload: {
    type: Boolean,
    default: true
  },
  
  maxFileSize: {
    type: Number,
    default: 50 * 1024 * 1024, // 50MB in bytes
    min: [1024, 'Maximum file size must be at least 1KB'],
    max: [500 * 1024 * 1024, 'Maximum file size cannot exceed 500MB']
  },
  
  allowedFileTypes: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  maxFiles: {
    type: Number,
    default: 10,
    min: [1, 'Maximum files must be at least 1'],
    max: [50, 'Maximum files cannot exceed 50']
  },
  
  // Task status and priority
  status: {
    type: String,
    enum: ['draft', 'active', 'archived', 'cancelled'],
    default: 'active',
    index: true
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  
  // Grading configuration
  gradingType: {
    type: String,
    enum: ['points', 'percentage', 'letter', 'pass_fail'],
    default: 'points'
  },
  
  rubric: [{
    criterion: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Criterion cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Criterion description cannot exceed 500 characters']
    },
    maxPoints: {
      type: Number,
      required: true,
      min: [1, 'Criterion points must be at least 1'],
      max: [100, 'Criterion points cannot exceed 100']
    }
  }],
  
  // Submission tracking
  submissions: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    status: {
      type: String,
      enum: ['submitted', 'graded', 'returned', 'late'],
      default: 'submitted'
    },
    
    comment: {
      type: String,
      maxlength: [1000, 'Submission comment cannot exceed 1000 characters'],
      trim: true,
      default: ''
    },
    
    files: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimetype: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    collaborators: [{
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Invalid collaborator email']
    }],
    
    // Grading information
    grade: {
      type: Number,
      min: 0,
      validate: {
        validator: function(v) {
          return v <= this.parent().maxPoints;
        },
        message: 'Grade cannot exceed maximum points for this task'
      }
    },
    
    feedback: {
      type: String,
      maxlength: [2000, 'Feedback cannot exceed 2000 characters'],
      trim: true,
      default: ''
    },
    
    rubricScores: [{
      criterion: String,
      score: Number,
      comment: String
    }],
    
    gradedAt: Date,
    
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    },
    
    // Submission metadata
    attemptNumber: {
      type: Number,
      default: 1,
      min: 1
    },
    
    isLate: {
      type: Boolean,
      default: false
    },
    
    ipAddress: String,
    userAgent: String
  }],
  
  // Task metadata
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  
  category: {
    type: String,
    trim: true,
    maxlength: [50, 'Category cannot exceed 50 characters'],
    default: 'General'
  },
  
  // Visibility and access
  visibility: {
    type: String,
    enum: ['public', 'team_only', 'individual'],
    default: 'team_only'
  },
  
  // System timestamps
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
taskSchema.index({ server: 1, status: 1, dueDate: 1 });
taskSchema.index({ faculty: 1, status: 1, createdAt: -1 });
taskSchema.index({ team: 1, status: 1, dueDate: 1 });
taskSchema.index({ student: 1, status: 1, dueDate: 1 });
taskSchema.index({ assignmentType: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ priority: 1, status: 1 });

// Text index for search
taskSchema.index({ 
  title: 'text', 
  description: 'text', 
  instructions: 'text',
  category: 'text'
});

// Virtual fields
taskSchema.virtual('isOverdue').get(function() {
  return new Date() > this.dueDate && this.status === 'active';
});

taskSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  return Math.max(0, due.getTime() - now.getTime());
});

taskSchema.virtual('submissionCount').get(function() {
  return this.submissions ? this.submissions.length : 0;
});

taskSchema.virtual('gradedCount').get(function() {
  return this.submissions ? this.submissions.filter(sub => sub.grade !== undefined).length : 0;
});

taskSchema.virtual('averageGrade').get(function() {
  if (!this.submissions || this.submissions.length === 0) return null;
  
  const gradedSubmissions = this.submissions.filter(sub => sub.grade !== undefined);
  if (gradedSubmissions.length === 0) return null;
  
  const total = gradedSubmissions.reduce((sum, sub) => sum + sub.grade, 0);
  return Math.round((total / gradedSubmissions.length) * 100) / 100;
});

taskSchema.virtual('lateSubmissions').get(function() {
  return this.submissions ? this.submissions.filter(sub => sub.isLate).length : 0;
});

// Pre-save middleware
taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set late submission flags
  this.submissions.forEach(submission => {
    if (submission.submittedAt > this.dueDate) {
      submission.isLate = true;
      submission.status = 'late';
    }
  });
  
  // Validate rubric points total
  if (this.rubric && this.rubric.length > 0) {
    const totalRubricPoints = this.rubric.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
    if (totalRubricPoints !== this.maxPoints) {
      return next(new Error('Total rubric points must equal maximum points'));
    }
  }
  
  next();
});

// Instance methods
taskSchema.methods.getSubmissionByStudent = function(studentId) {
  return this.submissions.find(sub => sub.student.toString() === studentId.toString());
};

taskSchema.methods.hasStudentSubmitted = function(studentId) {
  return this.submissions.some(sub => sub.student.toString() === studentId.toString());
};

taskSchema.methods.canStudentSubmit = function(studentId) {
  const studentSubmissions = this.submissions.filter(sub => sub.student.toString() === studentId.toString());
  const canSubmitAgain = studentSubmissions.length < this.maxAttempts;
  const notOverdue = this.allowLateSubmissions || !this.isOverdue;
  return canSubmitAgain && notOverdue && this.status === 'active';
};

taskSchema.methods.addSubmission = function(submissionData) {
  const studentId = submissionData.student;
  
  if (!this.canStudentSubmit(studentId)) {
    throw new Error('Student cannot submit at this time');
  }
  
  const existingSubmissions = this.submissions.filter(sub => sub.student.toString() === studentId.toString());
  
  const submission = {
    ...submissionData,
    submittedAt: new Date(),
    isLate: new Date() > this.dueDate,
    attemptNumber: existingSubmissions.length + 1
  };
  
  this.submissions.push(submission);
  return this.save();
};

taskSchema.methods.gradeSubmission = function(studentId, gradeData) {
  const submission = this.getSubmissionByStudent(studentId);
  if (!submission) {
    throw new Error('Submission not found');
  }
  
  if (gradeData.grade > this.maxPoints) {
    throw new Error('Grade cannot exceed maximum points');
  }
  
  submission.grade = gradeData.grade;
  submission.feedback = gradeData.feedback || '';
  submission.rubricScores = gradeData.rubricScores || [];
  submission.status = 'graded';
  submission.gradedAt = new Date();
  submission.gradedBy = gradeData.gradedBy;
  
  return this.save();
};

// Static methods
taskSchema.statics.findByServer = function(serverId) {
  return this.find({ server: serverId, status: 'active' })
    .populate('faculty', 'firstName lastName email')
    .populate('server', 'title code')
    .populate('team', 'name members')
    .sort({ dueDate: 1 });
};

taskSchema.statics.findByTeam = function(teamId) {
  return this.find({ team: teamId, status: 'active' })
    .populate('faculty', 'firstName lastName email')
    .populate('server', 'title code')
    .sort({ dueDate: 1 });
};

taskSchema.statics.findByStudent = async function(studentId) {
  const StudentTeam = mongoose.model('StudentTeam');
  const teamIds = await StudentTeam.find({ members: studentId }).distinct('_id');
  return this.find({ 
    $or: [
      { student: studentId },
      { 
        assignmentType: 'team',
        team: { $in: teamIds }
      }
    ],
    status: 'active'
  })
  .populate('faculty', 'firstName lastName email')
  .populate('server', 'title code')
  .populate('team', 'name members')
  .sort({ dueDate: 1 });
};

taskSchema.statics.findByFaculty = function(facultyId) {
  return this.find({ faculty: facultyId })
    .populate('server', 'title code')
    .populate('team', 'name members')
    .sort({ createdAt: -1 });
};

taskSchema.statics.findOverdueTasks = function() {
  return this.find({ 
    dueDate: { $lt: new Date() },
    status: 'active'
  });
};

taskSchema.statics.findUpcomingTasks = function(days = 7) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  return this.find({
    dueDate: { 
      $gte: new Date(),
      $lte: endDate
    },
    status: 'active'
  }).sort({ dueDate: 1 });
};

module.exports = mongoose.model('Task', taskSchema);