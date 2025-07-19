// backend/routes/taskRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Import middleware and models
const verifyToken = require('../middleware/verifyToken');
const Task = require('../models/taskSchema');
const Student = require('../models/studentSchema');
const Faculty = require('../models/facultySchema');
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
      return cb(new Error('File type not allowed for security reasons'), false);
    }
    
    cb(null, true);
  }
});

// ✅ FIXED: Add the missing student-tasks endpoint that the frontend is calling
router.get('/student-tasks', verifyToken, async (req, res) => {
  try {
    logWithTimestamp('info', '=== STUDENT TASKS REQUEST START ===', {
      studentId: req.user.id,
      userRole: req.user.role
    });

    // Validate user role
    if (req.user.role !== 'student') {
      logWithTimestamp('error', 'Access denied - non-student user', {
        userId: req.user.id,
        role: req.user.role
      });
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

    // Build query to find tasks
    let taskQuery = { status: 'active' };

    if (teamIds.length > 0) {
      taskQuery.$or = [
        { team: { $in: teamIds } },        // Team assignments
        { student: req.user.id }           // Individual assignments
      ];
    } else {
      // If student is not in any teams, only show individual assignments
      taskQuery.student = req.user.id;
    }

    // Find tasks assigned to these teams or individually
    const tasks = await Task.find(taskQuery)
      .populate('server', 'title code')
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email')
      .populate({
        path: 'submissions',
        match: { student: req.user.id }
      })
      .sort({ dueDate: 1 });

    logWithTimestamp('info', 'Raw tasks found', {
      studentId: req.user.id,
      taskCount: tasks.length,
      query: taskQuery
    });

    // Add submission status for each task
    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      
      // Find student's submission for this task
      const studentSubmission = task.submissions?.find(sub => 
        sub.student && sub.student.toString() === req.user.id
      );

      // Add submission metadata
      taskObj.submissionStatus = studentSubmission ? 'submitted' : 'not_submitted';
      taskObj.submissionDate = studentSubmission?.submittedAt;
      taskObj.grade = studentSubmission?.grade;
      taskObj.feedback = studentSubmission?.feedback;
      taskObj.isLate = studentSubmission?.isLate || false;
      taskObj.attemptNumber = studentSubmission?.attempt || 0;

      // Calculate if task is overdue
      taskObj.isOverdue = new Date() > new Date(task.dueDate);
      
      // Calculate time remaining
      const timeRemaining = new Date(task.dueDate) - new Date();
      taskObj.timeRemaining = Math.max(0, timeRemaining);

      return taskObj;
    });

    logWithTimestamp('info', 'Tasks processed with submission status', {
      studentId: req.user.id,
      totalTasks: tasksWithStatus.length,
      submittedTasks: tasksWithStatus.filter(t => t.submissionStatus === 'submitted').length,
      overdueTasks: tasksWithStatus.filter(t => t.isOverdue).length
    });

    logWithTimestamp('info', '=== STUDENT TASKS REQUEST COMPLETED ===', {
      studentId: req.user.id,
      tasksReturned: tasksWithStatus.length
    });

    res.json({
      success: true,
      tasks: tasksWithStatus,
      metadata: {
        totalTasks: tasksWithStatus.length,
        submittedTasks: tasksWithStatus.filter(t => t.submissionStatus === 'submitted').length,
        pendingTasks: tasksWithStatus.filter(t => t.submissionStatus === 'not_submitted').length,
        overdueTasks: tasksWithStatus.filter(t => t.isOverdue && t.submissionStatus === 'not_submitted').length,
        gradedTasks: tasksWithStatus.filter(t => t.grade !== undefined).length
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching student tasks', {
      error: error.message,
      stack: error.stack,
      studentId: req.user.id
    });

    console.error('❌ Student tasks error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
    .populate({
      path: 'submissions',
      match: { student: req.user.id }
    })
    .sort({ dueDate: 1 });

    // Add submission status for each task
    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      const studentSubmission = task.submissions?.find(sub => 
        sub.student.toString() === req.user.id
      );

      taskObj.submissionStatus = studentSubmission ? 'submitted' : 'not_submitted';
      taskObj.submissionDate = studentSubmission?.submittedAt;
      taskObj.grade = studentSubmission?.grade;
      taskObj.feedback = studentSubmission?.feedback;
      taskObj.isLate = studentSubmission?.isLate || false;

      return taskObj;
    });

    logWithTimestamp('info', 'Tasks fetched successfully for student', {
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
      studentId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TASK BY ID
router.get('/server/:serverId', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    // Optionally, add role-based access checks here

    const tasks = await Task.find({ server: serverId })
      .populate('server', 'title code')
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email');

    res.json({
      success: true,
      tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks for server',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});
// ✅ SUBMIT TASK (File Upload)
router.post('/:taskId/submit', verifyToken, upload.array('files', 10), async (req, res) => {
  const submissionId = uuidv4();
  
  logWithTimestamp('info', '=== TASK SUBMISSION START ===', {
    submissionId,
    taskId: req.params.taskId,
    userId: req.user?.id,
    userRole: req.user?.role,
    filesCount: req.files?.length || 0,
    headers: {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    }
  });

  try {
    // Validate user role
    if (req.user.role !== 'student') {
      logWithTimestamp('error', 'Access denied - non-student user', {
        userId: req.user.id,
        role: req.user.role
      });
      return res.status(403).json({
        success: false,
        message: 'Student access required.'
      });
    }

    // Find and validate task
    logWithTimestamp('info', 'Looking up task', { taskId: req.params.taskId });
    const task = await Task.findById(req.params.taskId).populate('team');
    
    if (!task) {
      logWithTimestamp('error', 'Task not found', { taskId: req.params.taskId });
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    logWithTimestamp('info', 'Task found successfully', {
      taskId: task._id,
      title: task.title,
      allowFileUpload: task.allowFileUpload,
      maxFileSize: task.maxFileSize,
      allowedFileTypes: task.allowedFileTypes,
      teamInfo: task.team ? {
        teamId: task.team._id,
        teamName: task.team.name,
        membersCount: task.team.members?.length || 0
      } : null
    });

    // Check if student is assigned to this task
    let isAssigned = false;
    
    if (task.assignmentType === 'individual' && task.student?.toString() === req.user.id) {
      isAssigned = true;
    } else if (task.team && task.team.members.some(member => member.toString() === req.user.id)) {
      isAssigned = true;
    }

    if (!isAssigned) {
      logWithTimestamp('error', 'Student not assigned to task', {
        studentId: req.user.id,
        taskId: task._id,
        assignmentType: task.assignmentType
      });
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this task'
      });
    }

    logWithTimestamp('info', 'Student assignment verified', {
      studentId: req.user.id,
      taskId: task._id
    });

    // Check submission attempts
    const existingSubmissions = task.submissions?.filter(s => 
      s.student.toString() === req.user.id
    ) || [];

    logWithTimestamp('info', 'Checking submission attempts', {
      existingSubmissions: existingSubmissions.length,
      maxAttempts: task.maxAttempts
    });

    if (existingSubmissions.length >= task.maxAttempts) {
      logWithTimestamp('error', 'Maximum submission attempts reached', {
        attempts: existingSubmissions.length,
        maxAttempts: task.maxAttempts
      });
      return res.status(400).json({
        success: false,
        message: `Maximum ${task.maxAttempts} submission attempts reached`
      });
    }

    // Extract submission data
    const { comment, collaborators } = req.body;
    
    // Parse collaborators if it's a string
    let collaboratorsList = [];
    if (collaborators) {
      try {
        collaboratorsList = typeof collaborators === 'string' 
          ? JSON.parse(collaborators) 
          : collaborators;
      } catch (parseError) {
        logWithTimestamp('error', 'Failed to parse collaborators', {
          collaborators,
          error: parseError.message
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid collaborators format'
        });
      }
    }

    // Validate required fields
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Submission comment is required'
      });
    }

    // Process uploaded files
    const processedFiles = [];
    
    if (req.files && req.files.length > 0) {
      logWithTimestamp('info', 'Processing uploaded files', {
        filesCount: req.files.length
      });

      for (let index = 0; index < req.files.length; index++) {
        const file = req.files[index];
        
        logWithTimestamp('info', `Processing file ${index + 1}`, {
          originalname: file.originalname,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype
        });

        // Validate file type if restrictions exist
        if (task.allowedFileTypes && task.allowedFileTypes.length > 0) {
          const fileExt = path.extname(file.originalname).toLowerCase().substring(1);
          if (!task.allowedFileTypes.includes(fileExt) && !task.allowedFileTypes.includes('all')) {
            logWithTimestamp('error', 'File type not allowed', {
              filename: file.originalname,
              extension: fileExt,
              allowedTypes: task.allowedFileTypes
            });
            
            // Clean up uploaded file
            try {
              await fs.promises.unlink(file.path);
            } catch (unlinkError) {
              logWithTimestamp('error', 'Failed to cleanup rejected file', {
                path: file.path,
                error: unlinkError.message
              });
            }
            
            return res.status(400).json({
              success: false,
              message: `File type .${fileExt} not allowed. Allowed types: ${task.allowedFileTypes.join(', ')}`
            });
          }
        }

        processedFiles.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date()
        });

        logWithTimestamp('info', `File ${index + 1} processed successfully`, {
          originalname: file.originalname,
          filename: file.filename
        });
      }
    }

    logWithTimestamp('info', 'All files processed successfully', {
      processedFiles: processedFiles.length
    });

    // Create submission object
    const submission = {
      id: submissionId,
      student: req.user.id,
      comment: comment,
      files: processedFiles,
      collaborators: collaboratorsList,
      submittedAt: new Date(),
      status: 'submitted',
      attempt: existingSubmissions.length + 1,
      isLate: new Date() > new Date(task.dueDate),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    logWithTimestamp('info', 'Created submission object', {
      submissionId: submission.id,
      studentId: submission.student,
      filesCount: submission.files.length,
      collaboratorsCount: submission.collaborators.length,
      attempt: submission.attempt,
      isLate: submission.isLate
    });

    // Add submission to task
    if (!task.submissions) {
      task.submissions = [];
    }
    task.submissions.push(submission);
    task.updatedAt = new Date();

    // Save task with new submission
    await task.save();

    logWithTimestamp('info', 'Task submission saved to database', {
      taskId: task._id,
      submissionId: submission.id
    });

    // Send notification to faculty if service is available
    if (NotificationService) {
      try {
        const student = await Student.findById(req.user.id);
        await NotificationService.notifyTaskSubmitted(task, submission, student);
      } catch (notifError) {
        logWithTimestamp('warn', 'Failed to send submission notification', {
          error: notifError.message
        });
      }
    }

    logWithTimestamp('info', '=== TASK SUBMISSION COMPLETED SUCCESSFULLY ===', {
      submissionId: submission.id,
      taskId: task._id,
      studentId: req.user.id,
      filesCount: processedFiles.length
    });

    res.status(201).json({
      success: true,
      message: 'Task submitted successfully',
      submission: {
        id: submission.id,
        submittedAt: submission.submittedAt,
        filesCount: processedFiles.length,
        status: submission.status,
        attempt: submission.attempt,
        isLate: submission.isLate
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Task submission error occurred', {
      error: error.message,
      stack: error.stack,
      taskId: req.params.taskId,
      userId: req.user?.id
    });
    
    // Clean up uploaded files on error
    if (req.files) {
      logWithTimestamp('info', 'Cleaning up files due to error', {
        filesCount: req.files.length
      });

      for (const file of req.files) {
        try {
          await fs.promises.unlink(file.path);
          logWithTimestamp('info', 'Cleaned up file', { path: file.path });
        } catch (cleanupError) {
          logWithTimestamp('error', 'Failed to cleanup file', {
            path: file.path,
            error: cleanupError.message
          });
        }
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to submit task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ UPDATE TASK
router.put('/:taskId', verifyToken, async (req, res) => {
  try {
    console.log("inside the taskId")
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Faculty access required'
      });
    }

    const task = await Task.findById(req.params.taskId);
    
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

    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'instructions', 'dueDate', 'maxPoints',
      'allowLateSubmissions', 'maxAttempts', 'allowFileUpload',
      'allowedFileTypes', 'maxFileSize', 'priority', 'status'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    task.updatedAt = new Date();
    await task.save();

    logWithTimestamp('info', 'Task updated successfully', {
      taskId: task._id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      task
    });

  } catch (error) {
    logWithTimestamp('error', 'Error updating task', {
      error: error.message,
      taskId: req.params.taskId,
      userId: req.user.id
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
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Faculty access required'
      });
    }

    const task = await Task.findById(req.params.taskId);
    
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

    await Task.findByIdAndDelete(req.params.taskId);

    logWithTimestamp('info', 'Task deleted successfully', {
      taskId: req.params.taskId,
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    logWithTimestamp('error', 'Error deleting task', {
      error: error.message,
      taskId: req.params.taskId,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GRADE SUBMISSION
router.post('/:taskId/grade', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Faculty access required'
      });
    }

    const { studentId, grade, feedback } = req.body;

    if (!studentId || grade === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and grade are required'
      });
    }

    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only grade your own tasks'
      });
    }

    // Find the submission
    const submission = task.submissions.find(sub => 
      sub.student.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Validate grade
    if (grade < 0 || grade > task.maxPoints) {
      return res.status(400).json({
        success: false,
        message: `Grade must be between 0 and ${task.maxPoints}`
      });
    }

    // Update submission
    submission.grade = grade;
    submission.feedback = feedback || '';
    submission.status = 'graded';
    submission.gradedAt = new Date();
    submission.gradedBy = req.user.id;

    await task.save();

    // Send notification to student if service is available
    if (NotificationService) {
      try {
        const student = await Student.findById(studentId);
        await NotificationService.notifyTaskVerified(task, student, grade, feedback);
      } catch (notifError) {
        logWithTimestamp('warn', 'Failed to send grading notification', {
          error: notifError.message
        });
      }
    }

    logWithTimestamp('info', 'Submission graded successfully', {
      taskId: task._id,
      studentId: studentId,
      grade: grade,
      gradedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Submission graded successfully',
      submission: {
        id: submission.id,
        grade: submission.grade,
        feedback: submission.feedback,
        gradedAt: submission.gradedAt,
        status: submission.status
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Error grading submission', {
      error: error.message,
      taskId: req.params.taskId,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to grade submission',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ CHECK TASK PERMISSIONS AND STATUS
router.get('/:taskId/check', verifyToken, async (req, res) => {
  try {
    logWithTimestamp('info', 'Task check request', {
      taskId: req.params.taskId,
      userId: req.user?.id
    });

    const task = await Task.findById(req.params.taskId).populate('team');
    
    if (!task) {
      logWithTimestamp('error', 'Task not found in check', { taskId: req.params.taskId });
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check student assignment
    let isAssigned = false;
    if (req.user.role === 'student') {
      if (task.assignmentType === 'individual' && task.student?.toString() === req.user.id) {
        isAssigned = true;
      } else if (task.team && task.team.members.some(member => member.toString() === req.user.id)) {
        isAssigned = true;
      }
    } else if (req.user.role === 'faculty') {
      isAssigned = task.faculty.toString() === req.user.id;
    }
    
    logWithTimestamp('info', 'Task check completed', {
      taskId: task._id,
      title: task.title,
      isAssigned: isAssigned,
      allowFileUpload: task.allowFileUpload,
      userRole: req.user.role
    });

    res.json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        allowFileUpload: task.allowFileUpload,
        maxFileSize: task.maxFileSize,
        allowedFileTypes: task.allowedFileTypes,
        maxAttempts: task.maxAttempts,
        dueDate: task.dueDate,
        status: task.status
      },
      permissions: {
        isAssigned: isAssigned,
        canSubmit: req.user.role === 'student' && isAssigned && task.status === 'active',
        canGrade: req.user.role === 'faculty' && isAssigned,
        canEdit: req.user.role === 'faculty' && isAssigned
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Task check error', {
      error: error.message,
      taskId: req.params.taskId
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking task'
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
      'POST /api/tasks/create',
      'POST /api/tasks/:taskId/submit',
      'GET /api/tasks/:taskId/check',
      'GET /api/tasks/health'
    ]
  });
});

// ✅ DEBUG ROUTE (Development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/debug/student-info', verifyToken, async (req, res) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'Student access required'
        });
      }

      // Get student info
      const student = await Student.findById(req.user.id);
      
      // Get student's teams
      const teams = await StudentTeam.find({ members: req.user.id })
        .populate('members', 'firstName lastName email');

      // Get all tasks in the system (for debugging)
      const allTasks = await Task.find({})
        .populate('team', 'name members')
        .populate('server', 'title code')
        .select('title team server assignmentType status');

      res.json({
        success: true,
        debug: {
          student: {
            id: student._id,
            name: `${student.firstName} ${student.lastName}`,
            email: student.email
          },
          teams: teams.map(team => ({
            id: team._id,
            name: team.name,
            members: team.members.length,
            projectServer: team.projectServer
          })),
          allTasks: allTasks.map(task => ({
            id: task._id,
            title: task.title,
            teamId: task.team?._id,
            teamName: task.team?.name,
            serverCode: task.server?.code,
            assignmentType: task.assignmentType,
            status: task.status,
            isStudentInTeam: task.team?.members.includes(req.user.id)
          }))
        }
      });

    } catch (error) {
      console.error('Debug route error:', error);
      res.status(500).json({
        success: false,
        message: 'Debug failed',
        error: error.message
      });
    }
  });
}

// ✅ ERROR HANDLING MIDDLEWARE
router.use((error, req, res, next) => {
  logWithTimestamp('error', 'Unhandled route error', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id
  });

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large (max 50MB)'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files (max 10 files)'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

console.log('📋 Task routes loaded successfully');

module.exports = router;