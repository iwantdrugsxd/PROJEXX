// backend/routes/taskRoutes.js - PRODUCTION ENHANCED VERSION
const express = require('express');
const router = express.Router();
const Task = require('../models/taskSchema');
const StudentTeam = require('../models/studentTeamSchema');
const Student = require('../models/studentSchema');
const Faculty = require('../models/facultySchema');
const ProjectServer = require('../models/projectServerSchema');
const verifyToken = require('../middleware/verifyToken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

console.log('🔧 Enhanced taskRoutes.js loaded');

// ✅ Rate Limiting
const createTaskLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 task creations per windowMs
  message: 'Too many tasks created from this IP, please try again later.'
});

const submitTaskLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 submissions per minute
  message: 'Too many submissions from this IP, please try again later.'
});

// ✅ Enhanced directory management
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
};

// ✅ Initialize upload directories
const initializeDirectories = async () => {
  const baseDir = path.join(__dirname, '../uploads');
  const subdirs = ['submissions', 'temp', 'archives'];
  
  try {
    await ensureDirectoryExists(baseDir);
    for (const subdir of subdirs) {
      await ensureDirectoryExists(path.join(baseDir, subdir));
    }
    console.log('✅ Upload directories initialized');
  } catch (error) {
    console.error('❌ Failed to initialize directories:', error);
  }
};

// Initialize on startup
initializeDirectories();

// ✅ Enhanced multer configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/submissions');
    
    try {
      await ensureDirectoryExists(uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('❌ Upload directory error:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      // Generate unique filename
      const uniqueId = uuidv4();
      const timestamp = Date.now();
      const ext = path.extname(file.originalname).toLowerCase();
      const baseName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50); // Limit length
      
      const filename = `${baseName}_${timestamp}_${uniqueId}${ext}`;
      
      console.log(`📎 Generated filename: ${filename}`);
      cb(null, filename);
    } catch (error) {
      console.error('❌ Filename generation error:', error);
      cb(error);
    }
  }
});

// ✅ Enhanced file filter
const fileFilter = (req, file, cb) => {
  try {
    console.log(`🔍 Filtering file: ${file.originalname}, mimetype: ${file.mimetype}`);
    
    // Get allowed types from task or use defaults
    const allowedTypes = req.allowedFileTypes || [
      'pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif',
      'mp4', 'mp3', 'zip', 'rar', 'py', 'js', 'html', 'css', 'json'
    ];
    
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    
    if (allowedTypes.includes(ext)) {
      console.log(`✅ File type ${ext} is allowed`);
      cb(null, true);
    } else {
      console.log(`❌ File type ${ext} is not allowed. Allowed: ${allowedTypes.join(', ')}`);
      cb(new Error(`File type .${ext} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  } catch (error) {
    console.error('❌ File filter error:', error);
    cb(error);
  }
};

// ✅ Configure multer with enhanced settings
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB default
    files: 10,
    fieldSize: 10 * 1024 * 1024 // 10MB for text fields
  }
});

// ✅ Multer error handling middleware
const handleMulterError = (error, req, res, next) => {
  console.error('❌ Multer error:', error);
  
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large. Maximum allowed size is 100MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum 10 files allowed.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field.';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too large.';
        break;
      default:
        message = `Upload error: ${error.message}`;
    }
    
    return res.status(400).json({
      success: false,
      message: message,
      code: error.code
    });
  }
  
  if (error.message.includes('File type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
};

// ✅ Enhanced task creation with validation
router.post('/create', createTaskLimit, verifyToken, async (req, res) => {
  try {
    console.log('📝 === TASK CREATION START ===');
    console.log('👤 Faculty:', req.user.id);
    console.log('📋 Request body:', req.body);
    
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can create tasks',
        success: false 
      });
    }

    // Enhanced validation
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

    // Validate required fields
    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }

    if (!description?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task description is required'
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Due date is required'
      });
    }

    if (!serverId) {
      return res.status(400).json({
        success: false,
        message: 'Server ID is required'
      });
    }

    if (!team || !Array.isArray(team) || team.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one team must be selected'
      });
    }

    // Validate due date
    const dueDateObj = new Date(dueDate);
    const now = new Date();
    if (dueDateObj <= now) {
      return res.status(400).json({
        success: false,
        message: 'Due date must be in the future'
      });
    }

    // Validate max points
    const maxPointsNum = parseInt(maxPoints);
    if (!maxPointsNum || maxPointsNum < 1 || maxPointsNum > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum points must be between 1 and 1000'
      });
    }

    // Verify server ownership
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only create tasks for your own servers'
      });
    }

    // Verify teams belong to the server
    const teams = await StudentTeam.find({
      _id: { $in: team },
      projectServer: server.code
    });

    if (teams.length !== team.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected teams do not belong to this server'
      });
    }

    console.log(`✅ Validated ${teams.length} teams for task creation`);

    // Create task with enhanced fields
    const task = new Task({
      title: title.trim(),
      description: description.trim(),
      instructions: instructions?.trim() || '',
      rubric: rubric?.trim() || '',
      dueDate: dueDateObj,
      maxPoints: maxPointsNum,
      faculty: req.user.id,
      server: serverId,
      team: team[0], // Primary team for compatibility
      team: team, // All assigned teams
      assignmentType: assignmentType || 'team',
      allowLateSubmissions: Boolean(allowLateSubmissions),
      maxAttempts: Math.min(Math.max(parseInt(maxAttempts) || 1, 1), 10),
      allowFileUpload: Boolean(allowFileUpload),
      allowedFileTypes: Array.isArray(allowedFileTypes) ? allowedFileTypes : [],
      maxFileSize: Math.min(parseInt(maxFileSize) || 50 * 1024 * 1024, 100 * 1024 * 1024),
      priority: priority || 'medium',
      autoGrade: Boolean(autoGrade),
      publishImmediately: Boolean(publishImmediately),
      status: publishImmediately ? 'active' : 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedTask = await task.save();
    console.log('✅ Task saved successfully:', savedTask._id);

    // TODO: Send notifications if enabled
    if (notifyStudents && publishImmediately) {
      console.log('📧 Notification sending not implemented yet');
    }

    console.log('📝 === TASK CREATION END ===');

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: {
        id: savedTask._id,
        title: savedTask.title,
        dueDate: savedTask.dueDate,
        maxPoints: savedTask.maxPoints,
        teamsCount: team.length,
        status: savedTask.status
      }
    });

  } catch (error) {
    console.error('❌ Task creation error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to create task',
      success: false 
    });
  }
});

// ✅ Enhanced task submission with robust file handling
router.post('/:taskId/submit', submitTaskLimit, verifyToken, async (req, res) => {
  console.log('📤 === TASK SUBMISSION START ===');
  console.log('📋 Task ID:', req.params.taskId);
  console.log('👤 Student:', req.user.id);

  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Only students can submit tasks',
        success: false 
      });
    }

    const { taskId } = req.params;

    // Get task with validation
    const task = await Task.findById(taskId)
      .populate('server', 'title code')
      .populate('team', 'name members');

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    console.log(`📋 Task found: ${task.title}`);

    // Check if task is published
    if (task.status === 'draft') {
      return res.status(400).json({
        success: false,
        message: 'This task is not yet published'
      });
    }

    // Check due date (if late submissions not allowed)
    if (!task.allowLateSubmissions && new Date() > new Date(task.dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Submission deadline has passed'
      });
    }

    // Verify student is in assigned teams
    const studentTeams = await StudentTeam.find({
      _id: { $in: task.team },
      members: req.user.id
    });

    if (studentTeams.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this task'
      });
    }

    console.log(`✅ Student is in ${studentTeams.length} assigned teams`);

    // Check submission attempts
    const existingSubmissions = task.submissions?.filter(s => 
      s.student.toString() === req.user.id
    ) || [];

    if (existingSubmissions.length >= task.maxAttempts) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${task.maxAttempts} submission attempts reached`
      });
    }

    // Set up multer with task-specific settings
    req.allowedFileTypes = task.allowedFileTypes;
    
    const uploadMiddleware = upload.array('files', 10);
    
    // Handle file upload
    await new Promise((resolve, reject) => {
      uploadMiddleware(req, res, (error) => {
        if (error) {
          handleMulterError(error, req, res, reject);
        } else {
          resolve();
        }
      });
    });

    console.log(`📎 Files uploaded: ${req.files?.length || 0}`);

    // Process form data
    const comment = req.body.comment?.trim() || '';
    let collaborators = [];
    
    try {
      if (req.body.collaborators) {
        collaborators = typeof req.body.collaborators === 'string' 
          ? JSON.parse(req.body.collaborators) 
          : req.body.collaborators;
        
        // Validate and filter collaborator emails
        collaborators = collaborators
          .filter(email => email && email.trim())
          .map(email => email.trim().toLowerCase())
          .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      }
    } catch (error) {
      console.warn('⚠️ Error parsing collaborators:', error);
      collaborators = [];
    }

    // Process uploaded files
    const processedFiles = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Validate file size against task limit
        if (file.size > task.maxFileSize) {
          // Clean up file
          try {
            await fs.unlink(file.path);
          } catch (cleanupError) {
            console.error('❌ Failed to cleanup oversized file:', cleanupError);
          }
          
          return res.status(400).json({
            success: false,
            message: `File ${file.originalname} exceeds size limit of ${Math.round(task.maxFileSize / 1024 / 1024)}MB`
          });
        }

        processedFiles.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date()
        });
      }
    }

    console.log(`✅ Processed ${processedFiles.length} files`);

    // Create submission object
    const submission = {
      id: uuidv4(),
      student: req.user.id,
      comment: comment,
      files: processedFiles,
      collaborators: collaborators,
      submittedAt: new Date(),
      status: 'submitted',
      attempt: existingSubmissions.length + 1,
      isLate: new Date() > new Date(task.dueDate),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Add submission to task
    if (!task.submissions) {
      task.submissions = [];
    }
    task.submissions.push(submission);
    task.updatedAt = new Date();

    // Save task with new submission
    await task.save();

    console.log('✅ Task submission saved successfully');
    console.log('📤 === TASK SUBMISSION END ===');

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
    console.error('❌ Task submission error:', error);
    console.log('📤 === TASK SUBMISSION ERROR END ===');
    
    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
          console.log(`🗑️ Cleaned up file: ${file.path}`);
        } catch (cleanupError) {
          console.error(`❌ Failed to cleanup file: ${file.path}`, cleanupError);
        }
      }
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to submit task',
      success: false 
    });
  }
});

// ✅ Enhanced get student tasks
router.get('/student-tasks', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Access denied. Student access required.',
        success: false 
      });
    }

    console.log(`📋 Fetching tasks for student: ${req.user.id}`);

    // Get student's teams
    const studentTeams = await StudentTeam.find({ 
      members: req.user.id 
    }).select('_id projectServer');

    if (studentTeams.length === 0) {
      return res.json({ 
        success: true, 
        tasks: [],
        message: 'No teams joined yet'
      });
    }

    const team = studentTeams.map(team => team._id);
    console.log(`👥 Student is in ${team.length} teams`);

    // Find tasks assigned to student's teams
    const tasks = await Task.find({
      $or: [
        { team: { $in: team } },
        { team: { $in: team } } // Backward compatibility
      ],
      status: { $ne: 'draft' } // Only published tasks
    })
    .populate('server', 'title code')
    .populate('team', 'name')
    .populate('team', 'name') // Backward compatibility
    .populate('faculty', 'firstName lastName')
    .sort({ createdAt: -1 });

    console.log(`📋 Found ${tasks.length} tasks for student`);

    // Add submission status for each task
    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      
      // Find student's submission
      const studentSubmission = task.submissions?.find(sub => 
        sub.student.toString() === req.user.id
      );

      taskObj.submissionStatus = studentSubmission ? {
        submitted: true,
        submittedAt: studentSubmission.submittedAt,
        status: studentSubmission.status,
        grade: studentSubmission.grade,
        feedback: studentSubmission.feedback,
        attempt: studentSubmission.attempt,
        isLate: studentSubmission.isLate
      } : {
        submitted: false,
        canSubmit: task.status === 'active' && 
                   (task.allowLateSubmissions || new Date() <= new Date(task.dueDate)),
        attemptsRemaining: task.maxAttempts
      };

      return taskObj;
    });

    res.json({ 
      success: true, 
      tasks: tasksWithStatus,
      count: tasksWithStatus.length,
      teamsCount: team.length
    });

  } catch (error) {
    console.error('❌ Error fetching student tasks:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tasks',
      success: false 
    });
  }
});

// ✅ Enhanced get faculty tasks
router.get('/faculty-tasks', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Access denied. Faculty access required.',
        success: false 
      });
    }

    console.log(`📋 Fetching tasks for faculty: ${req.user.id}`);

    // ✅ FIX: Properly define tasks variable
    const tasks = await Task.find({ faculty: req.user.id })
      .populate('server', 'title code')
      .populate('team', 'name members')
      .sort({ createdAt: -1 });

    console.log(`📋 Faculty has ${tasks.length} tasks`);

    res.json({ 
      success: true, 
      tasks: tasks || [],
      count: tasks.length
    });

  } catch (error) {
    console.error('❌ Error fetching faculty tasks:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tasks',
      success: false 
    });
  }
});
// ✅ Enhanced get server tasks with teams
router.get('/server/:serverId', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    console.log(`📋 Getting tasks for server: ${serverId}`);
    
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    // Check access permissions
    let hasAccess = false;
    
    if (req.user.role === 'faculty' && server.faculty.toString() === req.user.id) {
      hasAccess = true;
    } else if (req.user.role === 'student') {
      // Check if student is in any team for this server
      const studentTeam = await StudentTeam.findOne({
        projectServer: server.code,
        members: req.user.id
      });
      hasAccess = !!studentTeam;
    }

    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied to this server',
        success: false 
      });
    }

    const query = { server: serverId };
    
    // Students can only see published tasks
    if (req.user.role === 'student') {
      query.status = { $ne: 'draft' };
    }

    const tasks = await Task.find(query)
      .populate('team', 'name members')
      .populate('team', 'name members') // Backward compatibility
      .populate('faculty', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Add submission status for students
    let tasksWithStatus = tasks;
    if (req.user.role === 'student') {
      tasksWithStatus = tasks.map(task => {
        const taskObj = task.toObject();
        
        const studentSubmission = task.submissions?.find(sub => 
          sub.student.toString() === req.user.id
        );

        taskObj.submissionStatus = studentSubmission ? {
          submitted: true,
          submittedAt: studentSubmission.submittedAt,
          status: studentSubmission.status,
          grade: studentSubmission.grade,
          feedback: studentSubmission.feedback,
          attempt: studentSubmission.attempt,
          isLate: studentSubmission.isLate
        } : {
          submitted: false,
          canSubmit: task.status === 'active' && 
                     (task.allowLateSubmissions || new Date() <= new Date(task.dueDate)),
          attemptsRemaining: task.maxAttempts
        };

        return taskObj;
      });
    }

    console.log(`📋 Found ${tasksWithStatus.length} tasks for server ${server.title}`);

    res.json({ 
      success: true, 
      tasks: tasksWithStatus,
      serverTitle: server.title,
      serverCode: server.code,
      count: tasksWithStatus.length
    });

  } catch (error) {
    console.error('❌ Error fetching server tasks:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tasks',
      success: false 
    });
  }
});

// ✅ Enhanced get teams for server
// ✅ Get teams for server (for task creation)

router.get('/server/:serverId/teams', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    console.log(`👥 Loading teams for server: ${serverId}`);
    
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    // Verify faculty access
    if (req.user.role !== 'faculty' || server.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the server owner can view teams for task assignment'
      });
    }

    // Find teams for this server with enhanced data
    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    })
    .populate('members', 'student.firstName lastName email')
    .sort({ createdAt: -1 });

    console.log(`👥 Found ${teams.length} teams for server ${server.title}`);

    res.json({ 
      success: true, 
      teams: teams || [],
      serverTitle: server.title,
      serverCode: server.code,
      count: teams.length
    });

  } catch (error) {
    console.error('❌ Error fetching server teams:', error);
    res.status(500).json({ 
      message: 'Failed to fetch teams',
      success: false 
    });
  }
});

// ✅ Enhanced get individual task
router.get('/:taskId', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    console.log(`📋 Getting task details for: ${taskId}`);
    
    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('team', 'name members') // Backward compatibility
      .populate('server', 'title code')
      .populate('faculty', 'firstName lastName email')
      .populate('submissions.student', 'firstName lastName email');

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Check access permissions
    let hasAccess = false;
    let canViewSubmissions = false;

    if (req.user.role === 'faculty' && task.faculty._id.toString() === req.user.id) {
      hasAccess = true;
      canViewSubmissions = true;
    } else if (req.user.role === 'student') {
      // Check if student is assigned to this task
      const studentTeams = await StudentTeam.find({
        _id: { $in: task.team.map(t => t._id) },
        members: req.user.id
      });
      
      if (studentTeams.length > 0 && task.status !== 'draft') {
        hasAccess = true;
        // Students can only view their own submissions
        canViewSubmissions = false;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this task'
      });
    }

    const taskObj = task.toObject();

    // Filter submissions based on permissions
    if (!canViewSubmissions) {
      // Student can only see their own submission
      taskObj.submissions = task.submissions?.filter(sub => 
        sub.student._id.toString() === req.user.id
      ) || [];
    }

    // Add task statistics for faculty
    if (req.user.role === 'faculty') {
      const submissions = task.submissions || [];
      const totalStudents = task.team.reduce((total, team) => 
        total + (team.members?.length || 0), 0);

      taskObj.statistics = {
        totalSubmissions: submissions.length,
        uniqueSubmissions: new Set(submissions.map(s => s.student._id.toString())).size,
        totalStudents: totalStudents,
        submissionRate: totalStudents > 0 ? 
          Math.round((new Set(submissions.map(s => s.student._id.toString())).size / totalStudents) * 100) : 0,
        gradedSubmissions: submissions.filter(s => s.grade !== undefined).length,
        averageGrade: submissions.filter(s => s.grade !== undefined).length > 0 ?
          Math.round(submissions.filter(s => s.grade !== undefined)
            .reduce((sum, s) => sum + s.grade, 0) / 
            submissions.filter(s => s.grade !== undefined).length * 100) / 100 : null,
        lateSubmissions: submissions.filter(s => s.isLate).length,
        pendingGrades: submissions.filter(s => s.status === 'submitted' && s.grade === undefined).length
      };
    }

    // Add submission status for students
    if (req.user.role === 'student') {
      const studentSubmission = task.submissions?.find(sub => 
        sub.student._id.toString() === req.user.id
      );

      taskObj.submissionStatus = studentSubmission ? {
        submitted: true,
        submittedAt: studentSubmission.submittedAt,
        status: studentSubmission.status,
        grade: studentSubmission.grade,
        feedback: studentSubmission.feedback,
        attempt: studentSubmission.attempt,
        isLate: studentSubmission.isLate,
        canResubmit: studentSubmission.attempt < task.maxAttempts &&
                     (task.allowLateSubmissions || new Date() <= new Date(task.dueDate))
      } : {
        submitted: false,
        canSubmit: task.status === 'active' && 
                   (task.allowLateSubmissions || new Date() <= new Date(task.dueDate)),
        attemptsRemaining: task.maxAttempts
      };
    }

    res.json({
      success: true,
      task: taskObj
    });

  } catch (error) {
    console.error('❌ Error fetching task details:', error);
    res.status(500).json({ 
      message: 'Failed to fetch task details',
      success: false 
    });
  }
});

// ✅ Enhanced task grading
router.post('/:taskId/grade/:studentId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can grade submissions',
        success: false 
      });
    }

    const { taskId, studentId } = req.params;
    const { grade, feedback } = req.body;

    console.log(`📊 Grading task ${taskId} for student ${studentId}`);

    // Validate grade
    const gradeNum = parseFloat(grade);
    if (isNaN(gradeNum) || gradeNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'Grade must be a valid number >= 0'
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns this task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only grade your own tasks',
        success: false 
      });
    }

    // Validate grade doesn't exceed max points
    if (gradeNum > task.maxPoints) {
      return res.status(400).json({
        success: false,
        message: `Grade cannot exceed maximum points (${task.maxPoints})`
      });
    }

    // Find the submission
    const submissionIndex = task.submissions.findIndex(sub => 
      sub.student.toString() === studentId
    );

    if (submissionIndex === -1) {
      return res.status(404).json({ 
        message: 'Student submission not found',
        success: false 
      });
    }

    // Update the submission
    task.submissions[submissionIndex].grade = gradeNum;
    task.submissions[submissionIndex].feedback = feedback?.trim() || '';
    task.submissions[submissionIndex].status = 'graded';
    task.submissions[submissionIndex].gradedAt = new Date();
    task.submissions[submissionIndex].gradedBy = req.user.id;
    task.updatedAt = new Date();

    await task.save();

    console.log(`✅ Task graded: ${gradeNum}/${task.maxPoints}`);

    // TODO: Send notification to student

    res.json({
      success: true,
      message: 'Task graded successfully',
      grading: {
        grade: gradeNum,
        maxPoints: task.maxPoints,
        percentage: Math.round((gradeNum / task.maxPoints) * 100),
        feedback: feedback?.trim() || '',
        gradedAt: task.submissions[submissionIndex].gradedAt
      }
    });

  } catch (error) {
    console.error('❌ Grade task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to grade task',
      success: false 
    });
  }
});

// ✅ Enhanced get task submissions (for faculty)
router.get('/:taskId/submissions', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can view all submissions',
        success: false 
      });
    }

    const { taskId } = req.params;
    const { status, team, sortBy = 'submittedAt', order = 'desc' } = req.query;

    const task = await Task.findById(taskId)
      .populate('submissions.student', 'firstName lastName email')
      .populate('team', 'name members')
      .populate('team', 'name members'); // Backward compatibility

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only view submissions for your own tasks',
        success: false 
      });
    }

    let submissions = task.submissions || [];

    // Apply filters
    if (status && status !== 'all') {
      submissions = submissions.filter(sub => sub.status === status);
    }

    if (team) {
      // Filter by team - find students in the specified team
      const teamObj = await StudentTeam.findById(team);
      if (teamObj) {
        const teamMemberIds = teamObj.members.map(m => m.toString());
        submissions = submissions.filter(sub => 
          teamMemberIds.includes(sub.student._id.toString())
        );
      }
    }

    // Sort submissions
    submissions = submissions.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'submittedAt' || sortBy === 'gradedAt') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (order === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });

    // Add team information to each submission
    const submissionsWithTeams = submissions.map(sub => {
      const subObj = sub.toObject();
      
      // Find which team this student belongs to
      const studentTeam = task.team.find(team => 
        team.members.some(member => member._id.toString() === sub.student._id.toString())
      );
      
      subObj.studentTeam = studentTeam ? {
        id: studentTeam._id,
        name: studentTeam.name
      } : null;
      
      return subObj;
    });

    // Generate statistics
    const stats = {
      totalSubmissions: submissions.length,
      gradedSubmissions: submissions.filter(s => s.grade !== undefined).length,
      pendingGrades: submissions.filter(s => s.status === 'submitted' && s.grade === undefined).length,
      lateSubmissions: submissions.filter(s => s.isLate).length,
      averageGrade: submissions.filter(s => s.grade !== undefined).length > 0 ?
        Math.round(submissions.filter(s => s.grade !== undefined)
          .reduce((sum, s) => sum + s.grade, 0) / 
          submissions.filter(s => s.grade !== undefined).length * 100) / 100 : null,
      gradeDistribution: {
        A: submissions.filter(s => s.grade >= task.maxPoints * 0.9).length,
        B: submissions.filter(s => s.grade >= task.maxPoints * 0.8 && s.grade < task.maxPoints * 0.9).length,
        C: submissions.filter(s => s.grade >= task.maxPoints * 0.7 && s.grade < task.maxPoints * 0.8).length,
        D: submissions.filter(s => s.grade >= task.maxPoints * 0.6 && s.grade < task.maxPoints * 0.7).length,
        F: submissions.filter(s => s.grade < task.maxPoints * 0.6).length
      }
    };

    res.json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        maxPoints: task.maxPoints,
        dueDate: task.dueDate,
        allowLateSubmissions: task.allowLateSubmissions,
        maxAttempts: task.maxAttempts
      },
      submissions: submissionsWithTeams,
      statistics: stats,
      filters: { status, team, sortBy, order },
      count: submissionsWithTeams.length
    });

  } catch (error) {
    console.error('❌ Get submissions error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch submissions',
      success: false 
    });
  }
});

// ✅ Enhanced update task
router.put('/:taskId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can update tasks',
        success: false 
      });
    }

    const { taskId } = req.params;
    const updates = req.body;

    console.log(`📝 Updating task: ${taskId}`);

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only update your own tasks',
        success: false 
      });
    }

    // Validate updates
    if (updates.dueDate) {
      const dueDate = new Date(updates.dueDate);
      if (dueDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Due date must be in the future'
        });
      }
    }

    if (updates.maxPoints) {
      const maxPoints = parseInt(updates.maxPoints);
      if (!maxPoints || maxPoints < 1 || maxPoints > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Maximum points must be between 1 and 1000'
        });
      }
    }

    // Apply updates
    const allowedUpdates = [
      'title', 'description', 'instructions', 'rubric', 'dueDate', 'maxPoints',
      'allowLateSubmissions', 'maxAttempts', 'allowFileUpload', 'allowedFileTypes',
      'maxFileSize', 'priority', 'status'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        task[field] = updates[field];
      }
    });

    task.updatedAt = new Date();

    const updatedTask = await task.save();

    console.log(`✅ Task updated successfully: ${updatedTask.title}`);

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: {
        id: updatedTask._id,
        title: updatedTask.title,
        updatedAt: updatedTask.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to update task',
      success: false 
    });
  }
});

// ✅ Enhanced delete task
router.delete('/:taskId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can delete tasks',
        success: false 
      });
    }

    const { taskId } = req.params;

    console.log(`🗑️ Deleting task: ${taskId}`);

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only delete your own tasks',
        success: false 
      });
    }

    // Clean up associated files
    if (task.submissions && task.submissions.length > 0) {
      for (const submission of task.submissions) {
        if (submission.files && submission.files.length > 0) {
          for (const file of submission.files) {
            try {
              await fs.unlink(file.path);
              console.log(`🗑️ Deleted file: ${file.path}`);
            } catch (error) {
              console.warn(`⚠️ Failed to delete file: ${file.path}`, error);
            }
          }
        }
      }
    }

    await Task.findByIdAndDelete(taskId);

    console.log(`✅ Task deleted successfully: ${task.title}`);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to delete task',
      success: false 
    });
  }
});

// ✅ Download submission file
router.get('/submissions/:filename', verifyToken, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../uploads/submissions', filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // TODO: Add proper access control - verify user has permission to download this file

    res.download(filePath, (error) => {
      if (error) {
        console.error('❌ Download error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to download file'
        });
      }
    });

  } catch (error) {
    console.error('❌ Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

// ✅ General error handling middleware
router.use((error, req, res, next) => {
  console.error('❌ Task routes error:', error);
  
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      message: 'Validation failed',
      success: false,
      errors: errors
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID format',
      success: false
    });
  }
  
  res.status(500).json({
    message: error.message || 'Internal server error',
    success: false
  });
});

module.exports = router;