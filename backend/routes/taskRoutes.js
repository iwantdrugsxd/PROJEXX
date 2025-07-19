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
const verifyToken = require('../middleware/verifyToken'); // ✅ This matches your structure
const Task = require('../models/taskSchema');
const Student = require('../models/studentSchema');
const Faculty = require('../models/facultySchema'); // Add this if it exists
const StudentTeam = require('../models/studentTeamSchema');
const ProjectServer = require('../models/projectServerSchema');

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
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and hash
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
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Basic security check - reject executable files
    const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExts.includes(ext)) {
      return cb(new Error(`File type ${ext} is not allowed for security reasons`));
    }
    
    cb(null, true);
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

    // Validate user role
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
      team, // This should be an array of team IDs
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

    // Input validation
    if (!title || !description || !dueDate || !maxPoints || !serverId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, dueDate, maxPoints, serverId'
      });
    }

    // Validate due date
    const dueDateObj = new Date(dueDate);
    if (dueDateObj <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Due date must be in the future'
      });
    }

    // Validate server exists and user has access
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

    // Handle team assignment
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

    // Validate teams exist
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

    // Create separate task for each team
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

      // Send notifications if enabled and service is available
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

    logWithTimestamp('info', 'Tasks created successfully', {
      totalCreated: createdTasks.length,
      taskIds: createdTasks.map(t => t._id)
    });

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

// ✅ GET TASKS BY SERVER ID (NEW ENDPOINT)
router.get('/server/:serverId', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    logWithTimestamp('info', 'Fetching tasks by server ID', {
      serverId,
      userId: req.user.id,
      userRole: req.user.role
    });
    
    // Verify server exists and user has access
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'faculty') {
      if (server.faculty.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this server'
        });
      }
    } else {
      // Student access check
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

    // Get tasks for this server
    const tasks = await Task.find({ server: serverId })
      .populate('team', 'name members')
      .populate('server', 'title code')
      .populate('faculty', 'firstName lastName')
      .sort({ createdAt: -1 });

    logWithTimestamp('info', 'Tasks fetched successfully', {
      serverId,
      taskCount: tasks.length
    });

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

// ✅ GET TEAMS BY SERVER ID (NEW ENDPOINT)
router.get('/server/:serverId/teams', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    logWithTimestamp('info', 'Fetching teams by server ID', {
      serverId,
      userId: req.user.id,
      userRole: req.user.role
    });
    
    // Verify server exists and user has access
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    // Check access permissions (faculty only for team management)
    if (req.user.role !== 'faculty' || server.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Faculty access required for this server'
      });
    }

    // Get teams for this server
    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    }).populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email')
      .sort({ createdAt: -1 });

    logWithTimestamp('info', 'Teams fetched successfully', {
      serverId,
      serverCode: server.code,
      teamCount: teams.length
    });

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

    // Find teams the student belongs to
    const studentTeams = await StudentTeam.find({
      members: req.user.id
    });

    const teamIds = studentTeams.map(team => team._id);

    logWithTimestamp('info', 'Student teams found', {
      studentId: req.user.id,
      teamCount: teamIds.length,
      teamIds: teamIds
    });

    // Find tasks assigned to these teams
    const tasks = await Task.find({
      $or: [
        { team: { $in: teamIds } },
        { student: req.user.id } // Individual assignments
      ],
      status: 'active'
    })
    .populate('server', 'title code')
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email')
    .sort({ dueDate: 1 });

    // Add submission status for each task (simplified for now)
    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      taskObj.submissionStatus = 'pending'; // Default status
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

// ✅ GET TASKS FOR STUDENTS (Alternative endpoint for backwards compatibility)
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

    // Find teams the student belongs to
    const studentTeams = await StudentTeam.find({
      members: req.user.id
    });

    const teamIds = studentTeams.map(team => team._id);

    // Find tasks assigned to these teams
    const tasks = await Task.find({
      $or: [
        { team: { $in: teamIds } },
        { student: req.user.id } // Individual assignments
      ],
      status: 'active'
    })
    .populate('server', 'title code')
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email')
    .sort({ dueDate: 1 });

    // Add submission status for each task (simplified)
    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      taskObj.submissionStatus = 'pending'; // Default status
      return taskObj;
    });

    logWithTimestamp('info', 'Student tasks fetched successfully (legacy)', {
      studentId: req.user.id,
      taskCount: tasksWithStatus.length
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

// ✅ SUBMIT TASK
router.post('/:taskId/submit', upload.array('files', 10), verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { submissionText } = req.body;
    const files = req.files;

    logWithTimestamp('info', 'Task submission received', {
      taskId,
      studentId: req.user.id,
      hasText: !!submissionText,
      fileCount: files ? files.length : 0
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

    // Check if student is in the assigned team
    const isTeamMember = task.team && task.team.members.includes(req.user.id);
    if (!isTeamMember && task.assignmentType === 'team') {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of the assigned team'
      });
    }

    // Check if submissions are still allowed
    if (new Date() > task.dueDate && !task.allowLateSubmissions) {
      return res.status(400).json({
        success: false,
        message: 'Task deadline has passed and late submissions are not allowed'
      });
    }

    // Process file uploads
    const uploadedFiles = files ? files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    })) : [];

    logWithTimestamp('info', 'Task submission processed', {
      taskId,
      studentId: req.user.id,
      submissionText: submissionText ? 'Present' : 'None',
      uploadedFiles: uploadedFiles.length
    });

    res.json({
      success: true,
      message: 'Task submitted successfully',
      submission: {
        text: submissionText || '',
        files: uploadedFiles,
        submittedAt: new Date()
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

// ✅ HEALTH CHECK FOR TASKS ENDPOINT
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
      'POST /api/tasks/:taskId/submit',
      'PUT /api/tasks/:taskId',
      'DELETE /api/tasks/:taskId',
      'GET /api/tasks/health'
    ]
  });
});

module.exports = router;