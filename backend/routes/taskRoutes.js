// backend/routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const verifyToken = require('../middleware/verifyToken');
const Task = require("../models/taskSchema");
// Import your existing models - adjust paths as needed
const ProjectServer = require('../models/projectServerSchema');
const Student = require('../models/studentSchema');
const Faculty = require('../models/facultySchema');

// Create Task model if it doesn't exist
// let Task;
// try {
//   Task = require('../models/taskSchema');
// } catch (err) {
//   console.log('⚠️  Task model not found, creating basic schema');
//   const mongoose = require('mongoose');
  
  // const submissionSchema = new mongoose.Schema({
  //   student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  //   submittedAt: { type: Date, default: Date.now },
  //   fileName: String,
  //   filePath: String,
  //   fileSize: Number,
  //   comment: String,
  //   status: { type: String, enum: ['submitted', 'graded', 'returned'], default: 'submitted' },
  //   grade: { type: Number, min: 0, max: 100 },
  //   feedback: String,
  //   gradedAt: Date
  // });

  // const taskSchema = new mongoose.Schema({
  //   title: { type: String, required: true, trim: true },
  //   description: { type: String, required: true },
  //   server: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectServer', required: true },
  //   faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  //   dueDate: { type: Date, required: true },
  //   maxPoints: { type: Number, default: 100 },
  //   submissions: [submissionSchema],
  //   createdAt: { type: Date, default: Date.now },
  //   updatedAt: { type: Date, default: Date.now }
  // });

//   taskSchema.pre('save', function(next) {
//     this.updatedAt = Date.now();
//     next();
//   });

//   Task = mongoose.model('Task', taskSchema);
// }

console.log("🔧 taskRoutes.js loaded");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/tasks');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.zip', '.rar', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Create a new task (Faculty only)
router.post('/task/create', verifyToken, async (req, res) => {
  console.log('🎯 CREATE TASK route hit');
  console.log('User:', req.user);
  console.log('Body:', req.body);

  try {
    const { title, description, serverId, dueDate, maxPoints } = req.body;
    
    // Check if user is faculty
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can create tasks',
        success: false 
      });
    }
    
    // Verify faculty owns the server
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only create tasks for your own servers',
        success: false 
      });
    }

    const task = new Task({
      title,
      description,
      server: serverId,
      faculty: req.user.id,
      dueDate: new Date(dueDate),
      maxPoints: maxPoints || 100,
      createdAt: new Date()
    });

    await task.save();
    await task.populate('server', 'title');
    
    console.log('✅ Task created successfully:', task.title);
    res.json({ success: true, task });
  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to create task',
      success: false 
    });
  }
});

// Get tasks for a specific server
router.get('/server/:serverId', verifyToken, async (req, res) => {
  console.log('🎯 GET TASKS FOR SERVER route hit');
  console.log('User:', req.user);
  console.log('Server ID:', req.params.serverId);

  try {
    const { serverId } = req.params;
    
    // Verify user has access to this server
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    const isFaculty = req.user.role === 'faculty' && server.faculty.toString() === req.user.id;
    const isStudent = req.user.role === 'student' && server.students.includes(req.user.id);
    
    if (!isFaculty && !isStudent) {
      return res.status(403).json({ 
        message: 'You do not have access to this server',
        success: false 
      });
    }

    const tasks = await Task.find({ server: serverId })
      .populate('faculty', 'firstName lastName email')
      .populate('server', 'title')
      .sort({ createdAt: -1 });

    // Add submission status for students
    const tasksWithStatus = await Promise.all(tasks.map(async (task) => {
      const taskObj = task.toObject();
      if (!isFaculty && req.user.role === 'student') {
        const submission = task.submissions.find(s => s.student.toString() === req.user.id);
        taskObj.submissionStatus = submission ? submission.status : 'pending';
        taskObj.submissionDate = submission ? submission.submittedAt : null;
        taskObj.grade = submission ? submission.grade : null;
        taskObj.feedback = submission ? submission.feedback : null;
      }
      return taskObj;
    }));

    console.log(`✅ Found ${tasks.length} tasks for server ${serverId}`);
    res.json({ success: true, tasks: tasksWithStatus });
  } catch (error) {
    console.error('❌ Get tasks error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch tasks',
      success: false 
    });
  }
});

// Submit task (Students only)
router.post('/:taskId/submit', verifyToken, upload.single('file'), async (req, res) => {
  console.log('🎯 SUBMIT TASK route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);
  console.log('File:', req.file);

  try {
    const { taskId } = req.params;
    const { comment } = req.body;
    
    // Check if user is student
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Only students can submit tasks',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId).populate('server');
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify student is part of the server
    if (!task.server.students.includes(req.user.id)) {
      return res.status(403).json({ 
        message: 'You are not a member of this server',
        success: false 
      });
    }

    // Check if already submitted
    const existingSubmission = task.submissions.find(s => s.student.toString() === req.user.id);
    if (existingSubmission) {
      return res.status(400).json({ 
        message: 'You have already submitted this task',
        success: false 
      });
    }

    // Check deadline
    if (new Date() > task.dueDate) {
      return res.status(400).json({ 
        message: 'Task deadline has passed',
        success: false 
      });
    }

    const submission = {
      student: req.user.id,
      submittedAt: new Date(),
      comment: comment || '',
      status: 'submitted'
    };

    if (req.file) {
      submission.fileName = req.file.originalname;
      submission.filePath = req.file.path;
      submission.fileSize = req.file.size;
    }

    task.submissions.push(submission);
    await task.save();

    console.log('✅ Task submitted successfully');
    res.json({ success: true, message: 'Task submitted successfully' });
  } catch (error) {
    console.error('❌ Submit task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to submit task',
      success: false 
    });
  }
});

// Get task submissions (Faculty only)
router.get('/:taskId/submissions', verifyToken, async (req, res) => {
  console.log('🎯 GET SUBMISSIONS route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);

  try {
    const { taskId } = req.params;
    
    // Check if user is faculty
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can view submissions',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId)
      .populate('submissions.student', 'firstName lastName email')
      .populate('server');
    
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns the task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only view submissions for your own tasks',
        success: false 
      });
    }

    console.log(`✅ Found ${task.submissions.length} submissions`);
    res.json({ success: true, submissions: task.submissions });
  } catch (error) {
    console.error('❌ Get submissions error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch submissions',
      success: false 
    });
  }
});

// Grade task submission (Faculty only)
router.post('/:taskId/grade', verifyToken, async (req, res) => {
  console.log('🎯 GRADE TASK route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);
  console.log('Body:', req.body);

  try {
    const { taskId } = req.params;
    const { studentId, grade, feedback } = req.body;
    
    // Check if user is faculty
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can grade submissions',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns the task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only grade submissions for your own tasks',
        success: false 
      });
    }

    const submission = task.submissions.find(s => s.student.toString() === studentId);
    if (!submission) {
      return res.status(404).json({ 
        message: 'Submission not found',
        success: false 
      });
    }

    submission.grade = grade;
    submission.feedback = feedback;
    submission.status = 'graded';
    submission.gradedAt = new Date();

    await task.save();

    console.log('✅ Task graded successfully');
    res.json({ success: true, message: 'Task graded successfully' });
  } catch (error) {
    console.error('❌ Grade task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to grade task',
      success: false 
    });
  }
});

// Download submission file (Faculty only)
router.get('/:taskId/download/:studentId', verifyToken, async (req, res) => {
  console.log('🎯 DOWNLOAD FILE route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);
  console.log('Student ID:', req.params.studentId);

  try {
    const { taskId, studentId } = req.params;
    
    // Check if user is faculty
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can download submissions',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns the task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only download submissions for your own tasks',
        success: false 
      });
    }

    const submission = task.submissions.find(s => s.student.toString() === studentId);
    if (!submission || !submission.filePath) {
      return res.status(404).json({ 
        message: 'File not found',
        success: false 
      });
    }

    if (!fs.existsSync(submission.filePath)) {
      return res.status(404).json({ 
        message: 'File not found on server',
        success: false 
      });
    }

    console.log('✅ Downloading file:', submission.fileName);
    res.download(submission.filePath, submission.fileName);
  } catch (error) {
    console.error('❌ Download file error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to download file',
      success: false 
    });
  }
});

// Delete task (Faculty only)
router.delete('/:taskId', verifyToken, async (req, res) => {
  console.log('🎯 DELETE TASK route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);

  try {
    const { taskId } = req.params;
    
    // Check if user is faculty
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can delete tasks',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns the task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only delete your own tasks',
        success: false 
      });
    }

    // Delete associated files
    task.submissions.forEach(submission => {
      if (submission.filePath && fs.existsSync(submission.filePath)) {
        try {
          fs.unlinkSync(submission.filePath);
          console.log('🗑️ Deleted file:', submission.fileName);
        } catch (err) {
          console.warn('⚠️ Could not delete file:', submission.fileName, err.message);
        }
      }
    });

    await Task.findByIdAndDelete(taskId);
    console.log('✅ Task deleted successfully');
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('❌ Delete task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to delete task',
      success: false 
    });
  }
});

// Test route
router.get('/test', (req, res) => {
  console.log('✅ Task routes test successful');
  res.json({ 
    message: 'Task routes working!', 
    timestamp: new Date(),
    success: true 
  });
});

module.exports = router;