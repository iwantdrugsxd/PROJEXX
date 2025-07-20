// backend/routes/taskRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// ✅ FIXED: Import middleware and models with correct paths
const verifyToken = require('../middleware/verifyToken');
const Task = require('../models/taskSchema');
const Student = require('../models/studentSchema');
const Faculty = require('../models/facultySchema');
const StudentTeam = require('../models/studentTeamSchema');
const ProjectServer = require('../models/projectServerSchema');
const Submission = require('../models/Submission');

// Try to import NotificationService (optional)
let NotificationService;
try {
  NotificationService = require('../services/notificationService');
} catch (err) {
  console.log('⚠️  NotificationService not found - notifications disabled');
}

// Enhanced logging function
const logWithTimestamp = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [TASK_ROUTES] [${level.toUpperCase()}] ${message}`;
  
  if (level === 'error') {
    console.error(logMessage, data ? JSON.stringify(data, null, 2) : '');
  } else if (level === 'warn') {
    console.warn(logMessage, data ? JSON.stringify(data, null, 2) : '');
  } else {
    console.log(logMessage, data ? JSON.stringify(data, null, 2) : '');
  }
};

// File storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userRole = req.user?.role || 'unknown';
    const uploadPath = path.join(__dirname, '../uploads', userRole);
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30);
    
    const filename = `${baseName}_${timestamp}_${randomHash}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExts.includes(ext)) {
      return cb(new Error(`File type ${ext} is not allowed for security reasons`));
    }
    
    cb(null, true);
  }
});

// ===============================
// SPECIFIC ROUTES FIRST (HIGHEST PRIORITY)
// ===============================

// ✅ GET TASKS FOR STUDENTS
router.get('/student-tasks', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Student access required'
      });
    }

    logWithTimestamp('info', 'Fetching tasks for student', {
      studentId: req.user.id
    });

    const studentTeams = await StudentTeam.find({
      members: req.user.id
    });

    const teamIds = studentTeams.map(team => team._id);

    const tasks = await Task.find({
      $or: [
        { team: { $in: teamIds } },
        { student: req.user.id }
      ],
      status: 'active'
    })
    .populate('server', 'title code')
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email')
    .sort({ dueDate: 1 });

    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      taskObj.submissionStatus = 'pending';
      return taskObj;
    });

    logWithTimestamp('info', 'Student tasks fetched successfully', {
      studentId: req.user.id,
      taskCount: tasksWithStatus.length
    });

    res.json({
      success: true,
      tasks: tasksWithStatus
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching student tasks', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TASKS FOR STUDENTS (Alternative endpoint)
router.get('/student', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Student access required'
      });
    }

    logWithTimestamp('info', 'Fetching tasks for student (legacy endpoint)', {
      studentId: req.user.id
    });

    const studentTeams = await StudentTeam.find({
      members: req.user.id
    });

    const teamIds = studentTeams.map(team => team._id);

    const tasks = await Task.find({
      $or: [
        { team: { $in: teamIds } },
        { student: req.user.id }
      ],
      status: 'active'
    })
    .populate('server', 'title code')
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email')
    .sort({ dueDate: 1 });

    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      taskObj.submissionStatus = 'pending';
      return taskObj;
    });

    res.json({
      success: true,
      tasks: tasksWithStatus
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching student tasks (legacy)', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TASKS FOR FACULTY
router.get('/faculty', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Faculty access required'
      });
    }

    const { serverId, status, page = 1, limit = 10 } = req.query;
    
    let query = { faculty: req.user.id };
    
    if (serverId) {
      query.server = serverId;
    }
    
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tasks = await Task.find(query)
      .populate('server', 'title code')
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching faculty tasks', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TASKS BY SERVER ID
router.get('/server/:serverId', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    logWithTimestamp('info', 'Fetching tasks by server ID', {
      serverId,
      userId: req.user.id,
      userRole: req.user.role
    });
    
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    if (req.user.role === 'faculty') {
      if (server.faculty.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this server'
        });
      }
    } else {
      const studentTeam = await StudentTeam.findOne({
        members: req.user.id,
        projectServer: server.code
      });
      if (!studentTeam) {
        return res.status(403).json({
          success: false,
          message: 'You need to be in a team for this server'
        });
      }
    }

    const tasks = await Task.find({ server: serverId })
      .populate('team', 'name members')
      .populate('server', 'title code')
      .populate('faculty', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      tasks: tasks || []
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching server tasks', {
      error: error.message,
      serverId: req.params.serverId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
});

// ✅ GET TEAMS BY SERVER ID
router.get('/server/:serverId/teams', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    if (req.user.role !== 'faculty' || server.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Faculty access required for this server'
      });
    }

    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    }).populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      teams: teams || [],
      serverCode: server.code
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching server teams', {
      error: error.message,
      serverId: req.params.serverId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams'
    });
  }
});

// ✅ CREATE TASK ROUTE
router.post('/create', verifyToken, async (req, res) => {
  try {
    logWithTimestamp('info', '=== TASK CREATION START ===', {
      userId: req.user.id,
      userRole: req.user.role,
      body: req.body
    });

    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Only faculty members can create tasks'
      });
    }

    const {
      title,
      description,
      instructions,
      rubric,
      dueDate,
      maxPoints,
      serverId,
      team,
      assignmentType,
      allowLateSubmissions,
      maxAttempts,
      allowFileUpload,
      allowedFileTypes,
      maxFileSize,
      priority,
      autoGrade,
      publishImmediately,
      notifyStudents
    } = req.body;

    if (!title || !description || !dueDate || !maxPoints || !serverId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, dueDate, maxPoints, serverId'
      });
    }

    const dueDateObj = new Date(dueDate);
    if (dueDateObj <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Due date must be in the future'
      });
    }

    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Project server not found'
      });
    }

    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only create tasks for your own servers'
      });
    }

    let teamIds = [];
    if (assignmentType === 'team') {
      if (!team || !Array.isArray(team) || team.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one team must be selected for team assignments'
        });
      }
      teamIds = team;
    }

    if (teamIds.length > 0) {
      const teams = await StudentTeam.find({ _id: { $in: teamIds } });
      if (teams.length !== teamIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected teams do not exist'
        });
      }
    }

    const createdTasks = [];

    for (const teamId of teamIds) {
      const taskData = {
        title,
        description,
        instructions: instructions || '',
        dueDate: dueDateObj,
        maxPoints: parseInt(maxPoints),
        server: serverId,
        team: teamId,
        faculty: req.user.id,
        assignmentType: assignmentType || 'team',
        allowLateSubmissions: allowLateSubmissions || false,
        maxAttempts: parseInt(maxAttempts) || 1,
        allowFileUpload: allowFileUpload || false,
        allowedFileTypes: allowedFileTypes || [],
        maxFileSize: parseInt(maxFileSize) || 10485760,
        priority: priority || 'medium',
        status: publishImmediately ? 'active' : 'draft'
      };

      const task = new Task(taskData);
      await task.save();
      createdTasks.push(task);

      if (notifyStudents && publishImmediately && NotificationService) {
        try {
          await NotificationService.notifyTaskAssigned(task, teamId);
        } catch (notifError) {
          logWithTimestamp('warn', 'Failed to send task notification', {
            taskId: task._id,
            teamId: teamId,
            error: notifError.message
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdTasks.length} task(s)`,
      totalCreated: createdTasks.length,
      tasks: createdTasks.map(task => ({
        id: task._id,
        title: task.title,
        teamId: task.team,
        status: task.status
      }))
    });

  } catch (error) {
    logWithTimestamp('error', 'Task creation failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===============================
// DYNAMIC ROUTES (LOWER PRIORITY)
// ===============================

// ✅ GET SINGLE TASK BY ID - CRITICAL: BEFORE OTHER /:taskId ROUTES
router.get('/:taskId', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
     console.log('Fetching task:', taskId, 'for user:', req.user.id);
    logWithTimestamp('info', 'Fetching single task', {
      taskId,
      userId: req.user.id,
      userRole: req.user.role
    });

    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code')
      .populate('faculty', 'firstName lastName email');

    if (!task) {
      logWithTimestamp('error', 'Task not found', { taskId });
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check access permissions
    let hasAccess = false;
    
    if (req.user.role === 'faculty') {
      hasAccess = task.faculty._id.toString() === req.user.id;
    } else if (req.user.role === 'student') {
      if (task.team) {
        hasAccess = task.team.members.some(member => member.toString() === req.user.id);
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this task'
      });
    }

    // Add submission status for students
    let submissionStatus = null;
    if (req.user.role === 'student' && task.submissions) {
      const userSubmission = task.submissions.find(s => 
        s.student.toString() === req.user.id
      );
      submissionStatus = userSubmission ? {
        submitted: true,
        submittedAt: userSubmission.submittedAt,
        status: userSubmission.status,
        attempt: userSubmission.attempt
      } : { submitted: false };
    }

    logWithTimestamp('info', 'Task fetched successfully', {
      taskId,
      hasAccess,
      submissionStatus: submissionStatus ? 'found' : 'none'
    });

    res.json({
      success: true,
      task: {
        ...task.toObject(),
        submissionStatus
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching single task', {
      error: error.message,
      taskId: req.params.taskId,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ SUBMIT TASK
router.post('/:taskId/submit', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { submissionText, textSubmission } = req.body;

    logWithTimestamp('info', 'Task submission received', {
      taskId,
      studentId: req.user.id,
      hasText: !!(submissionText || textSubmission)
    });

    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit tasks'
      });
    }

    const task = await Task.findById(taskId)
      .populate('team', 'members')
      .populate('server', 'title code');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if student is assigned to task
    let hasAccess = false;
    if (task.team) {
      hasAccess = task.team.members.some(member => member.toString() === req.user.id);
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this task'
      });
    }

    const textContent = submissionText || textSubmission;
    
    if (!textContent || textContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Submission text is required'
      });
    }

    // Check existing submissions
    let existingSubmissionIndex = -1;
    if (task.submissions) {
      existingSubmissionIndex = task.submissions.findIndex(s => 
        s.student.toString() === req.user.id
      );
    }

    const submissionData = {
      id: uuidv4(),
      student: req.user.id,
      submissionText: textContent.trim(),
      submittedAt: new Date(),
      status: 'submitted',
      attempt: existingSubmissionIndex >= 0 ? task.submissions[existingSubmissionIndex].attempt + 1 : 1,
      isLate: new Date() > new Date(task.dueDate),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    if (!task.submissions) {
      task.submissions = [];
    }

    if (existingSubmissionIndex >= 0) {
      task.submissions[existingSubmissionIndex] = submissionData;
    } else {
      task.submissions.push(submissionData);
    }

    task.updatedAt = new Date();
    await task.save();

    logWithTimestamp('info', 'Task submitted successfully', {
      taskId,
      studentId: req.user.id,
      submissionId: submissionData.id
    });

    res.json({
      success: true,
      message: 'Task submitted successfully',
      submission: {
        id: submissionData.id,
        submittedAt: submissionData.submittedAt,
        status: submissionData.status,
        attempt: submissionData.attempt,
        isLate: submissionData.isLate,
        type: 'text'
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Task submission error', {
      error: error.message,
      taskId: req.params.taskId,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to submit task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TASK SUBMISSIONS (Faculty only)
router.get('/:taskId/submissions', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Faculty only.'
      });
    }

    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .populate('team', 'members')
      .populate({
        path: 'submissions.student',
        select: 'firstName lastName email'
      });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Get submissions from task schema
    const allSubmissions = [];
    if (task.submissions) {
      task.submissions.forEach(submission => {
        if (submission.submissionText) {
          allSubmissions.push({
            id: submission.id,
            type: 'text',
            student: submission.student,
            content: submission.submissionText,
            submittedAt: submission.submittedAt,
            status: submission.status,
            attempt: submission.attempt,
            isLate: submission.isLate
          });
        }
      });
    }

    // Try to get file submissions from submission schema (if Google Drive is set up)
    try {
      const driveSubmissions = await Submission.find({ task: taskId })
        .populate('student', 'firstName lastName email')
        .populate('files');

      driveSubmissions.forEach(submission => {
        allSubmissions.push({
          id: submission._id,
          type: 'files',
          student: {
            _id: submission.student._id,
            firstName: submission.student.firstName,
            lastName: submission.student.lastName,
            email: submission.student.email
          },
          comment: submission.comment,
          collaborators: submission.collaborators,
          files: submission.files,
          driveFolderId: submission.driveFolderId,
          submittedAt: submission.submittedAt,
          status: submission.status,
          isLate: submission.isLate
        });
      });
    } catch (driveError) {
      // Google Drive submissions not available - continue with text submissions only
      logWithTimestamp('warn', 'Google Drive submissions not available', {
        error: driveError.message
      });
    }

    allSubmissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate
      },
      submissions: allSubmissions
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching task submissions', {
      error: error.message,
      taskId: req.params.taskId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message
    });
  }
});

// ✅ UPDATE TASK
router.put('/:taskId', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Only faculty can update tasks'
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own tasks'
      });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('server', 'title code')
     .populate('team', 'name members')
     .populate('faculty', 'firstName lastName');

    res.json({
      success: true,
      task: updatedTask,
      message: 'Task updated successfully'
    });

  } catch (error) {
    logWithTimestamp('error', 'Task update error', {
      error: error.message,
      taskId: req.params.taskId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ DELETE TASK
router.delete('/:taskId', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Only faculty can delete tasks'
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own tasks'
      });
    }

    await Task.findByIdAndDelete(taskId);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    logWithTimestamp('error', 'Task deletion error', {
      error: error.message,
      taskId: req.params.taskId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===============================
// HEALTH CHECK (LOWEST PRIORITY - LAST)
// ===============================

// ✅ HEALTH CHECK - MOVED TO END
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Task routes are working',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /api/tasks/student-tasks',
      'GET /api/tasks/student',
      'GET /api/tasks/faculty',
      'GET /api/tasks/server/:serverId',
      'GET /api/tasks/server/:serverId/teams',
      'POST /api/tasks/create',
      'GET /api/tasks/:taskId',
      'POST /api/tasks/:taskId/submit',
      'GET /api/tasks/:taskId/submissions',
      'PUT /api/tasks/:taskId',
      'DELETE /api/tasks/:taskId',
      'GET /api/tasks/health'
    ]
  });
});
router.use((req, res, next) => {
  console.log(`[TASK ROUTES] Unmatched route: ${req.method} ${req.originalUrl}`);
  next();
});

module.exports = router;