// backend/routes/taskRoutes.js - COMPLETE ERROR-FREE PRODUCTION VERSION
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

console.log('🔧 Loading taskRoutes.js...');

// ✅ Import middleware - using try-catch to handle missing files
const verifyToken = require('../middleware/verifyToken');

// Safe import of rate limiter
let uploadLimiter, generalLimiter;
try {
  const rateLimiter = require('../middleware/rateLimiter');
  uploadLimiter = rateLimiter.uploadLimiter;
  generalLimiter = rateLimiter.generalLimiter;
  console.log('✅ Rate limiter loaded for tasks');
} catch (err) {
  console.log('⚠️  Rate limiter not found - using pass-through middleware');
  uploadLimiter = (req, res, next) => next();
  generalLimiter = (req, res, next) => next();
}

// ✅ Import existing models (these should exist based on your server output)
const Task = require('../models/taskSchema');
const Student = require('../models/studentSchema');
const Faculty = require('../models/facultySchema');
const StudentTeam = require('../models/studentTeamSchema');
const ProjectServer = require('../models/projectServerSchema');

// ✅ Safe import of new models (if they don't exist, disable features)
let Submission = null;
let DriveFile = null;
let hasFileUploadSupport = false;

try {
  Submission = require('../models/Submission');
  DriveFile = require('../models/DriveFile');
  hasFileUploadSupport = true;
  console.log('✅ File upload models loaded');
} catch (err) {
  console.log('⚠️  File upload models not found - file features disabled');
}

// Safe import of notification service
let NotificationService = null;
try {
  NotificationService = require('../services/notificationService');
  console.log('✅ NotificationService loaded for tasks');
} catch (err) {
  console.log('⚠️  NotificationService not found');
}

// ===============================
// LOGGING UTILITY
// ===============================
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

// ===============================
// MULTER CONFIGURATION (Basic - for text uploads only)
// ===============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userRole = req.user?.role || 'unknown';
    const uploadPath = path.join(__dirname, '../uploads', userRole);
    
    // Create directory if it doesn't exist
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
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5
  },
  fileFilter: (req, file, cb) => {
    // Basic security check
    const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExts.includes(ext)) {
      return cb(new Error(`File type ${ext} is not allowed for security reasons`));
    }
    
    cb(null, true);
  }
});

// Apply rate limiting if available
if (generalLimiter && typeof generalLimiter === 'function') {
  router.use(generalLimiter);
}

// ===============================
// STATIC ROUTES (HIGHEST PRIORITY)
// ===============================

// ✅ HEALTH CHECK - Always first
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Task routes are working',
    timestamp: new Date().toISOString(),
    features: {
      fileUpload: hasFileUploadSupport,
      textSubmissions: true,
      notifications: !!NotificationService,
      rateLimiting: uploadLimiter !== null
    },
    routes: [
      'GET /api/tasks/health',
      'GET /api/tasks/student-tasks',
      'GET /api/tasks/faculty',
      'GET /api/tasks/student',
      'GET /api/tasks/server/:serverId',
      'GET /api/tasks/server/:serverId/teams',
      'POST /api/tasks/create',
      'GET /api/tasks/:taskId',
      'POST /api/tasks/:taskId/submit',
      'GET /api/tasks/:taskId/submissions',
      'PUT /api/tasks/:taskId',
      'DELETE /api/tasks/:taskId'
    ]
  });
});

// ✅ GET TASKS FOR STUDENTS - Main endpoint
// ✅ REPLACE your entire /student-tasks route with this EXACT code

router.get('/student-tasks', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Student access required'
      });
    }

    logWithTimestamp('info', 'Fetching student tasks', { studentId: req.user.id });

    // ✅ CRITICAL FIX: NO .populate('projectServer') anywhere
    const studentTeams = await StudentTeam.find({
      members: req.user.id
    });
    // ❌ REMOVED: .populate('projectServer') - this was causing the error

    if (!studentTeams || studentTeams.length === 0) {
      console.log(`📊 Student ${req.user.id} is not in any teams`);
      return res.json({
        success: true,
        tasks: [],
        totalTasks: 0,
        pendingTasks: 0,
        completedTasks: 0,
        teams: 0,
        message: 'No teams found. Join a team to see tasks.'
      });
    }

    const teamIds = studentTeams.map(team => team._id);
    console.log(`📊 Student is in ${teamIds.length} teams`);

    // ✅ FIXED QUERY: Correct status values and no projectServer populate
    const tasks = await Task.find({
      team: { $in: teamIds },
      status: 'active' // ✅ Only use 'active' (removed 'published')
    })
    .populate('server', 'title code description')
    .populate('team', 'name members') // ✅ REMOVED projectServer from here
    .populate('faculty', 'firstName lastName email')
    .sort({ dueDate: 1 });

    console.log(`📊 Found ${tasks.length} tasks for student`);

    // Debug what we found
    if (tasks.length === 0) {
      console.log('🔍 No active tasks found, checking all statuses...');
      const allTasks = await Task.find({ team: { $in: teamIds } });
      console.log(`🔍 Total tasks for teams (any status): ${allTasks.length}`);
      if (allTasks.length > 0) {
        const statuses = [...new Set(allTasks.map(t => t.status))];
        console.log('🔍 Available task statuses:', statuses);
      }
    }

    // Process tasks and add submission status
    const tasksWithStatus = await Promise.all(tasks.map(async (task) => {
      const taskObj = task.toObject();
      
      // Initialize submission data
      let hasSubmission = false;
      let submissionData = null;

      // Check text submissions in task schema
      if (task.submissions && Array.isArray(task.submissions)) {
        const userSubmission = task.submissions.find(sub => 
          sub.student && sub.student.toString() === req.user.id
        );
        if (userSubmission) {
          hasSubmission = true;
          submissionData = {
            type: 'text',
            status: userSubmission.status || 'submitted',
            submittedAt: userSubmission.submittedAt,
            grade: userSubmission.grade,
            feedback: userSubmission.feedback,
            attemptNumber: userSubmission.attemptNumber || userSubmission.attempt || 1,
            isLate: userSubmission.isLate || false
          };
        }
      }

      // Check file submissions if available and no text submission found
      if (!hasSubmission && hasFileUploadSupport && Submission) {
        try {
          const fileSubmission = await Submission.findOne({
            task: task._id,
            student: req.user.id
          });

          if (fileSubmission) {
            hasSubmission = true;
            submissionData = {
              type: 'files',
              status: fileSubmission.status,
              submittedAt: fileSubmission.submittedAt,
              grade: fileSubmission.grade,
              feedback: fileSubmission.feedback,
              attemptNumber: fileSubmission.attemptNumber || 1,
              isLate: fileSubmission.isLate || false,
              fileCount: fileSubmission.files ? fileSubmission.files.length : 0
            };
          }
        } catch (fileErr) {
          console.log(`⚠️ File submission check failed for task ${task.title}:`, fileErr.message);
        }
      }

      // Set submission status
      if (hasSubmission && submissionData) {
        Object.assign(taskObj, {
          submissionStatus: submissionData.status,
          submittedAt: submissionData.submittedAt,
          grade: submissionData.grade,
          feedback: submissionData.feedback,
          attemptNumber: submissionData.attemptNumber,
          isLate: submissionData.isLate,
          hasSubmission: true,
          submissionType: submissionData.type
        });
        
        if (submissionData.fileCount) {
          taskObj.fileCount = submissionData.fileCount;
        }
      } else {
        Object.assign(taskObj, {
          submissionStatus: 'pending',
          submittedAt: null,
          grade: null,
          feedback: null,
          attemptNumber: 0,
          isLate: false,
          hasSubmission: false,
          submissionType: null
        });
      }
      
      // Add time calculations
      if (task.dueDate) {
        const now = new Date();
        const dueDate = new Date(task.dueDate);
        taskObj.timeRemaining = Math.max(0, dueDate - now);
        taskObj.isOverdue = now > dueDate && !taskObj.hasSubmission;
        taskObj.daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      }
      
      // Add team info safely
      if (task.team) {
        taskObj.teamName = task.team.name || 'Unknown Team';
        taskObj.teamMemberCount = (task.team.members && Array.isArray(task.team.members)) ? task.team.members.length : 0;
      }
      
      return taskObj;
    }));

    // Calculate statistics
    const completedTasks = tasksWithStatus.filter(t => t.hasSubmission).length;
    const pendingTasks = tasksWithStatus.filter(t => !t.hasSubmission).length;
    const overdueTasks = tasksWithStatus.filter(t => t.isOverdue).length;

    console.log(`✅ Student analytics calculated: ${completedTasks}/${tasks.length} tasks completed`);

    const response = {
      success: true,
      tasks: tasksWithStatus,
      totalTasks: tasksWithStatus.length,
      pendingTasks: pendingTasks,
      completedTasks: completedTasks,
      overdueTasks: overdueTasks,
      teams: studentTeams.length,
      statistics: {
        completionRate: tasksWithStatus.length > 0 ? Math.round((completedTasks / tasksWithStatus.length) * 100) : 0,
        onTimeSubmissions: Math.max(0, completedTasks - tasksWithStatus.filter(t => t.hasSubmission && t.isLate).length),
        averageGrade: tasksWithStatus.length > 0 ? (
          tasksWithStatus
            .filter(t => t.grade !== null && t.grade !== undefined)
            .reduce((sum, t) => sum + (t.grade || 0), 0) / 
          Math.max(1, tasksWithStatus.filter(t => t.grade !== null && t.grade !== undefined).length)
        ) : 0
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching student tasks:', error);
    logWithTimestamp('error', 'Error fetching student tasks', {
      error: error.message,
      userId: req.user.id,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? {
        userId: req.user.id,
        errorType: error.name,
        errorMessage: error.message
      } : undefined
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

    // Add submission stats for each task
    const tasksWithStats = await Promise.all(tasks.map(async (task) => {
      const taskObj = task.toObject();
      
      try {
        const textSubmissions = task.submissions ? task.submissions.length : 0;
        let fileSubmissions = 0;
        
        if (hasFileUploadSupport && Submission) {
          try {
            fileSubmissions = await Submission.countDocuments({ task: task._id });
          } catch (err) {
            // File submissions not available
          }
        }
        
        taskObj.submissionStats = {
          totalSubmissions: textSubmissions + fileSubmissions,
          textSubmissions,
          fileSubmissions
        };
      } catch (err) {
        taskObj.submissionStats = {
          totalSubmissions: 0,
          textSubmissions: 0,
          fileSubmissions: 0
        };
      }
      
      return taskObj;
    }));

    res.json({
      success: true,
      tasks: tasksWithStats,
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

// ✅ GET TASKS FOR STUDENTS (Legacy endpoint)
router.get('/student', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Student access required'
      });
    }

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

// ===============================
// SERVER-SPECIFIC ROUTES
// ===============================

// ✅ GET TASKS BY SERVER ID
router.get('/server/:serverId', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    // Check permissions
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

// ===============================
// CREATE ROUTES
// ===============================

// ✅ CREATE TASK
router.post('/create', verifyToken, async (req, res) => {
  try {
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
      maxFiles,
      priority,
      publishImmediately,
      notifyStudents
    } = req.body;

    // Validation
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

    // Verify server ownership
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

    // Handle team assignments
    let teamIds = [];
    if (assignmentType === 'team') {
      if (!team || !Array.isArray(team) || team.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one team must be selected for team assignments'
        });
      }
      teamIds = team;

      // Verify teams exist
      const teams = await StudentTeam.find({ _id: { $in: teamIds } });
      if (teams.length !== teamIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected teams do not exist'
        });
      }
    }

    const createdTasks = [];

    // Create tasks for each team
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
        allowedFileTypes: allowedFileTypes || ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png'],
        maxFileSize: parseInt(maxFileSize) || 10485760, // 10MB default
        maxFiles: parseInt(maxFiles) || 5,
        priority: priority || 'medium',
        status: publishImmediately ? 'active' : 'draft'
      };

      const task = new Task(taskData);
      await task.save();
      createdTasks.push(task);

      // Send notifications if available
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
        status: task.status,
        allowFileUpload: task.allowFileUpload
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
// DYNAMIC ROUTES (LOWEST PRIORITY)
// ===============================

// ✅ GET SINGLE TASK BY ID
router.get('/:taskId', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code')
      .populate('faculty', 'firstName lastName email');

    if (!task) {
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
    if (req.user.role === 'student') {
      // Check text submissions first
      if (task.submissions) {
        const userSubmission = task.submissions.find(s => 
          s.student.toString() === req.user.id
        );
        if (userSubmission) {
          submissionStatus = {
            submitted: true,
            submittedAt: userSubmission.submittedAt,
            status: userSubmission.status,
            attempt: userSubmission.attempt || userSubmission.attemptNumber,
            type: 'text'
          };
        }
      }
      
      // Check file submissions if no text submission and file support available
      if (!submissionStatus && hasFileUploadSupport && Submission) {
        try {
          const fileSubmission = await Submission.findOne({
            task: taskId,
            student: req.user.id
          });
          
          if (fileSubmission) {
            submissionStatus = {
              submitted: true,
              submittedAt: fileSubmission.submittedAt,
              status: fileSubmission.status,
              attempt: fileSubmission.attemptNumber,
              type: 'files',
              fileCount: fileSubmission.files ? fileSubmission.files.length : 0
            };
          }
        } catch (err) {
          // File submissions not available
        }
      }
      
      if (!submissionStatus) {
        submissionStatus = { submitted: false };
      }
    }

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

// ✅ SUBMIT TASK (Text submissions only - fallback)
router.post('/:taskId/submit', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { submissionText, textSubmission, comment } = req.body;

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

    const textContent = submissionText || textSubmission || comment;
    
    if (!textContent || textContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Submission text is required'
      });
    }

    // If task allows file upload, redirect to file upload system
    if (task.allowFileUpload && hasFileUploadSupport) {
      return res.status(400).json({
        success: false,
        message: 'This task requires file upload. Please use the file upload system.',
        requiresFiles: true,
        redirectTo: '/api/files/upload/' + taskId,
        allowedFileTypes: task.allowedFileTypes,
        maxFileSize: task.maxFileSize
      });
    }

    // Handle text submission
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

    logWithTimestamp('info', 'Text task submitted successfully', {
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
    const { page = 1, limit = 20, status, sortBy = 'submittedAt', sortOrder = 'desc' } = req.query;

    const task = await Task.findById(taskId)
      .populate('team', 'members name')
      .populate('faculty', 'firstName lastName email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if faculty owns this task
    if (task.faculty._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this task'
      });
    }

    const allSubmissions = [];

    // Get text submissions from task schema
    if (task.submissions && task.submissions.length > 0) {
      for (const submission of task.submissions) {
        try {
          const student = await Student.findById(submission.student).select('firstName lastName email studentId');
          
          if (student) {
            allSubmissions.push({
              id: submission.id || submission._id,
              type: 'text',
              student: {
                _id: student._id,
                firstName: student.firstName,
                lastName: student.lastName,
                email: student.email,
                studentId: student.studentId
              },
              content: submission.submissionText,
              comment: submission.submissionText,
              submittedAt: submission.submittedAt,
              status: submission.status || 'submitted',
              attemptNumber: submission.attempt || submission.attemptNumber || 1,
              isLate: submission.isLate || false,
              grade: submission.grade || null,
              feedback: submission.feedback || null,
              gradedAt: submission.gradedAt || null
            });
          }
        } catch (err) {
          console.warn('Error processing text submission:', err.message);
        }
      }
    }

    // Get file submissions if available
    if (hasFileUploadSupport && Submission) {
      try {
        const fileSubmissions = await Submission.find({ task: taskId })
          .populate('student', 'firstName lastName email studentId')
          .populate('files', 'originalName size mimeType webViewLink webContentLink isImage')
          .sort({ submittedAt: sortOrder === 'desc' ? -1 : 1 });

        fileSubmissions.forEach(submission => {
          allSubmissions.push({
            id: submission._id,
            type: 'files',
            student: {
              _id: submission.student._id,
              firstName: submission.student.firstName,
              lastName: submission.student.lastName,
              email: submission.student.email,
              studentId: submission.student.studentId
            },
            comment: submission.comment,
            collaborators: submission.collaborators || [],
            files: submission.files ? submission.files.map(file => ({
              id: file._id,
              originalName: file.originalName,
              size: file.size,
              mimeType: file.mimeType,
              webViewLink: file.webViewLink,
              webContentLink: file.webContentLink,
              isImage: file.isImage
            })) : [],
            fileCount: submission.files ? submission.files.length : 0,
            submittedAt: submission.submittedAt,
            status: submission.status,
            attemptNumber: submission.attemptNumber || 1,
            isLate: submission.isLate || false,
            grade: submission.grade || null,
            feedback: submission.feedback || null,
            gradedAt: submission.gradedAt || null
          });
        });
      } catch (driveError) {
        console.warn('File submissions not available:', driveError.message);
      }
    }

    // Apply filters
    let filteredSubmissions = allSubmissions;
    if (status) {
      filteredSubmissions = allSubmissions.filter(sub => sub.status === status);
    }

    // Sort submissions
    filteredSubmissions.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'submittedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedSubmissions = filteredSubmissions.slice(skip, skip + parseInt(limit));

    // Calculate statistics
    const stats = {
      totalSubmissions: allSubmissions.length,
      textSubmissions: allSubmissions.filter(s => s.type === 'text').length,
      fileSubmissions: allSubmissions.filter(s => s.type === 'files').length,
      gradedSubmissions: allSubmissions.filter(s => s.grade !== null).length,
      lateSubmissions: allSubmissions.filter(s => s.isLate).length
    };

    res.json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        maxPoints: task.maxPoints,
        allowFileUpload: task.allowFileUpload,
        teamName: task.team?.name
      },
      submissions: paginatedSubmissions,
      statistics: stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredSubmissions.length,
        pages: Math.ceil(filteredSubmissions.length / parseInt(limit))
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching task submissions', {
      error: error.message,
      taskId: req.params.taskId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

    // Filter allowed update fields
    const allowedUpdates = [
      'title', 'description', 'instructions', 'dueDate', 'maxPoints',
      'allowLateSubmissions', 'maxAttempts', 'allowFileUpload', 
      'allowedFileTypes', 'maxFileSize', 'maxFiles', 'priority', 'status'
    ];

    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    // Validate due date if being updated
    if (updateData.dueDate) {
      const dueDate = new Date(updateData.dueDate);
      if (dueDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Due date must be in the future'
        });
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $set: updateData },
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

    // Check if task has submissions
    const hasTextSubmissions = task.submissions && task.submissions.length > 0;
    let hasFileSubmissions = false;
    
    if (hasFileUploadSupport && Submission) {
      try {
        const fileSubmissionCount = await Submission.countDocuments({ task: taskId });
        hasFileSubmissions = fileSubmissionCount > 0;
      } catch (err) {
        // File submissions not available
      }
    }

    if (hasTextSubmissions || hasFileSubmissions) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete task with existing submissions. Archive it instead.',
        hasSubmissions: true,
        textSubmissions: hasTextSubmissions,
        fileSubmissions: hasFileSubmissions
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
// ERROR HANDLING
// ===============================

// Error handling middleware
router.use((err, req, res, next) => {
  logWithTimestamp('error', 'Task routes error caught', {
    error: err.message,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files allowed.'
      });
    }
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler for unmatched routes
router.use((req, res) => {
  logWithTimestamp('warn', 'Unmatched route accessed', {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id
  });
  
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedRoute: req.originalUrl,
    availableRoutes: [
      'GET /api/tasks/health',
      'GET /api/tasks/student-tasks',
      'GET /api/tasks/faculty',
      'GET /api/tasks/:taskId',
      'POST /api/tasks/create',
      'POST /api/tasks/:taskId/submit',
      'GET /api/tasks/:taskId/submissions'
    ]
  });
});

console.log('✅ Task routes loaded successfully');
console.log('🔧 All task routes defined');

module.exports = router;