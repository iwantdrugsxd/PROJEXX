const express = require('express');
const router = express.Router();
const Task = require('../models/taskSchema');
const StudentTeam = require('../models/studentTeamSchema');
const Student = require('../models/studentSchema');
const ProjectServer = require('../models/projectServerSchema');
const verifyToken = require('../middleware/verifyToken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

console.log('🔧 taskRoutes.js loaded');

// Enhanced directory creation with error handling
const ensureUploadsDirectory = (req, res, next) => {
  const uploadsDir = path.join(__dirname, '../uploads');
  const submissionsDir = path.join(uploadsDir, 'submissions');
  
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('📁 Created uploads directory');
    }
    
    if (!fs.existsSync(submissionsDir)) {
      fs.mkdirSync(submissionsDir, { recursive: true });
      console.log('📁 Created submissions directory');
    }
    
    next();
  } catch (error) {
    console.error('❌ Error creating directories:', error);
    res.status(500).json({
      message: 'Failed to create upload directories',
      success: false
    });
  }
};

// Use directory middleware for all routes
router.use(ensureUploadsDirectory);

// Robust filename sanitization to prevent ENOENT errors
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads/submissions');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('📁 Created submissions directory');
    }
    
    console.log(`📂 Upload destination: ${uploadsDir}`);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    try {
      // Simpler filename generation to avoid truncation
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1000);
      const ext = path.extname(file.originalname).toLowerCase();
      
      // Simplified base name handling
      let baseName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9]/g, '_') // Replace all special chars with underscore
        .substring(0, 20); // Shorter limit to prevent path issues
      
      // Ensure we have a valid base name
      if (!baseName || baseName.length === 0) {
        baseName = 'file';
      }
      
      // Generate shorter filename to prevent path length issues
      const finalFilename = `${baseName}_${timestamp}_${randomSuffix}${ext}`;
      
      console.log(`📎 Original: ${file.originalname}`);
      console.log(`📎 Generated: ${finalFilename}`);
      console.log(`📎 Final path will be: ${path.join(__dirname, '../uploads/submissions', finalFilename)}`);
      
      cb(null, finalFilename);
    } catch (error) {
      console.error('❌ Error in filename generation:', error);
      // Fallback to simple filename
      const fallbackName = `file_${Date.now()}${path.extname(file.originalname)}`;
      console.log(`🔄 Using fallback filename: ${fallbackName}`);
      cb(null, fallbackName);
    }
  }
});

// Multer configuration with better error handling
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    console.log(`📎 Processing file: ${file.originalname} (${file.mimetype})`);
    
    // Basic security check - reject dangerous files
    const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExts.includes(ext)) {
      console.log(`❌ Rejected dangerous file type: ${ext}`);
      return cb(new Error(`File type ${ext} not allowed for security reasons`), false);
    }
    
    cb(null, true);
  }
});

// ✅ DEBUG: Add logging middleware BEFORE the upload route
router.use('/:taskId/submit', (req, res, next) => {
  console.log('🎯 === SUBMIT ROUTE HIT ===');
  console.log('📋 Task ID:', req.params.taskId);
  console.log('👤 User:', req.user?.id, req.user?.role);
  console.log('📦 Content-Type:', req.headers['content-type']);
  console.log('📊 Body keys:', Object.keys(req.body || {}));
  console.log('📎 Files (pre-multer):', req.files ? 'Yes' : 'No');
  next();
});

// Multer error handling middleware
const multerErrorHandler = (error, req, res, next) => {
  console.error('❌ Multer error:', error);
  
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer specific error:', error.code, error.message);
    return res.status(400).json({
      message: `File upload error: ${error.message}`,
      success: false,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.code === 'ENOENT') {
    console.error('❌ File system error:', error);
    return res.status(500).json({
      message: 'File system error - upload directory not accessible',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.message.includes('File type') && error.message.includes('not allowed')) {
    return res.status(400).json({
      message: error.message,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  // Pass to general error handler
  next(error);
};

// ✅ TEST ROUTE: Create a test route without multer
router.post('/:taskId/test-submit', verifyToken, async (req, res) => {
  console.log('🧪 === TEST SUBMIT ROUTE HIT ===');
  console.log('📋 Task ID:', req.params.taskId);
  console.log('👤 User:', req.user?.id, req.user?.role);
  
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({
        message: 'Task not found in database',
        success: false,
        taskId: req.params.taskId
      });
    }

    console.log('✅ Task found:', task.title);

    res.json({
      success: true,
      message: 'Test route working',
      taskFound: true,
      taskTitle: task.title,
      taskId: task._id
    });
  } catch (error) {
    console.error('❌ Test submit error:', error);
    res.status(500).json({
      message: error.message,
      success: false
    });
  }
});

// Get all tasks for faculty
router.get('/faculty-tasks', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Access denied. Faculty access required.',
        success: false 
      });
    }

    const tasks = await Task.find({ faculty: req.user.id })
      .populate('team', 'name members')
      .populate('server', 'title code')
      .sort({ createdAt: -1 });

    console.log(`📋 Faculty ${req.user.id} has ${tasks.length} tasks`);

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

// Get all tasks for student
router.get('/student-tasks', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Access denied. Student access required.',
        success: false 
      });
    }

    console.log(`📋 Loading tasks for student: ${req.user.id}`);

    // Find teams the student is a member of
    const studentTeams = await StudentTeam.find({ 
      members: req.user.id 
    });

    console.log(`👥 Student is in ${studentTeams.length} teams`);

    const teamIds = studentTeams.map(team => team._id);

    // Find tasks assigned to those teams
    const tasks = await Task.find({ 
      team: { $in: teamIds }
    })
    .populate('team', 'name members')
    .populate('server', 'title code')
    .populate('faculty', 'firstName lastName email')
    .sort({ dueDate: 1 });

    // Add submission status for each task
    const tasksWithStatus = tasks.map(task => {
      const studentSubmission = task.submissions?.find(sub => 
        sub.student && sub.student.toString() === req.user.id
      );
      
      return {
        ...task.toObject(),
        submissionStatus: studentSubmission ? studentSubmission.status : 'pending',
        submissionDate: studentSubmission ? studentSubmission.submittedAt : null,
        grade: studentSubmission ? studentSubmission.grade : null,
        feedback: studentSubmission ? studentSubmission.feedback : null
      };
    });

    console.log(`📋 Found ${tasksWithStatus.length} tasks for student`);

    res.json({ 
      success: true, 
      tasks: tasksWithStatus || [],
      count: tasksWithStatus.length
    });
  } catch (error) {
    console.error('❌ Error fetching student tasks:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tasks',
      success: false 
    });
  }
});

// Get tasks for a specific server
router.get('/server/:serverId', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    console.log(`📋 Loading tasks for server: ${serverId}`);
    
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    // For faculty: show all tasks they created for this server
    // For students: show tasks for teams they're members of
    let query = { server: serverId };
    
    if (req.user.role === 'faculty') {
      query.faculty = req.user.id;
    } else {
      // Find student's teams for this server
      const studentTeams = await StudentTeam.find({ 
        members: req.user.id,
        projectServer: server.code
      });
      const teamIds = studentTeams.map(team => team._id);
      query.team = { $in: teamIds };
    }

    const tasks = await Task.find(query)
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    console.log(`📋 Found ${tasks.length} tasks for server ${server.title}`);

    res.json({ 
      success: true, 
      tasks: tasks || [],
      serverTitle: server.title
    });
  } catch (error) {
    console.error('❌ Error fetching server tasks:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tasks',
      success: false 
    });
  }
});

// Get teams for a server (for task creation)
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

    // Find teams for this server
    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    }).populate('members', 'firstName lastName email');

    console.log(`👥 Found ${teams.length} teams for server ${server.title}`);

    res.json({ 
      success: true, 
      teams: teams || [],
      serverTitle: server.title
    });
  } catch (error) {
    console.error('❌ Error fetching server teams:', error);
    res.status(500).json({ 
      message: 'Failed to fetch teams',
      success: false 
    });
  }
});

// Create new task
router.post('/create', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can create tasks',
        success: false 
      });
    }

    console.log('📝 Task creation request from faculty:', req.user.id);
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

    const {
      serverId,
      teamIds,
      title,
      description,
      dueDate,
      maxPoints,
      allowLateSubmissions,
      maxAttempts,
      allowFileUpload,
      allowedFileTypes,
      maxFileSize,
      priority
    } = req.body;

    // Validate required fields
    if (!serverId || !title || !description || !dueDate) {
      return res.status(400).json({
        message: 'Missing required fields: serverId, title, description, dueDate',
        success: false
      });
    }

    // Verify server exists and belongs to faculty
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

    // Process allowed file types
    let processedAllowedFileTypes = [];
    if (allowFileUpload && allowedFileTypes) {
      if (Array.isArray(allowedFileTypes)) {
        processedAllowedFileTypes = allowedFileTypes;
      } else if (typeof allowedFileTypes === 'string') {
        try {
          processedAllowedFileTypes = JSON.parse(allowedFileTypes);
        } catch {
          processedAllowedFileTypes = allowedFileTypes.split(',').map(type => type.trim());
        }
      }
    }

    const targetTeamIds = Array.isArray(teamIds) ? teamIds : (teamIds ? [teamIds] : []);
    
    if (targetTeamIds.length === 0) {
      return res.status(400).json({
        message: 'At least one team must be selected',
        success: false
      });
    }

    // Verify teams exist and belong to the server
    const teams = await StudentTeam.find({
      _id: { $in: targetTeamIds },
      projectServer: server.code
    });

    if (teams.length !== targetTeamIds.length) {
      return res.status(400).json({
        message: 'One or more teams not found or not part of this server',
        success: false
      });
    }

    console.log(`📝 Creating task for ${teams.length} teams`);

    // Create tasks for each team
    const createdTasks = [];
    for (const team of teams) {
      const task = new Task({
        faculty: req.user.id,
        server: serverId,
        team: team._id,
        title,
        description,
        dueDate: new Date(dueDate),
        maxPoints: parseInt(maxPoints) || 100,
        allowLateSubmissions: allowLateSubmissions || false,
        maxAttempts: parseInt(maxAttempts) || 1,
        allowFileUpload: allowFileUpload || false,
        allowedFileTypes: processedAllowedFileTypes,
        maxFileSize: parseInt(maxFileSize) || 10485760, // 10MB default
        priority: priority || 'medium',
        status: 'active'
      });

      await task.save();
      createdTasks.push(task);
    }

    console.log(`✅ Created ${createdTasks.length} tasks for server ${server.title}`);

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdTasks.length} task(s)`,
      tasks: createdTasks.map(task => ({
        id: task._id,
        title: task.title,
        teamId: task.team,
        dueDate: task.dueDate,
        allowedFileTypes: task.allowedFileTypes
      }))
    });

  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to create task',
      success: false 
    });
  }
});

// ✅ MAIN TASK SUBMISSION ROUTE
router.post('/:taskId/submit', verifyToken, upload.array('files', 10), multerErrorHandler, async (req, res) => {
  try {
    console.log('📤 === TASK SUBMISSION START ===');
    console.log('📋 Task ID:', req.params.taskId);
    console.log('👤 User:', req.user.id, req.user.role);
    console.log('📎 Files received:', req.files ? req.files.length : 0);
    console.log('💬 Comment:', req.body.comment ? 'Yes' : 'No');
    console.log('👥 Collaborators:', req.body.collaborators ? 'Yes' : 'No');

    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Only students can submit tasks',
        success: false 
      });
    }

    const { taskId } = req.params;
    const { comment, collaborators } = req.body;

    // Get task details first
    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code');

    if (!task) {
      console.log('❌ Task not found:', taskId);
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    console.log('✅ Task found:', task.title);

    // Check if student is member of the team this task is assigned to
    const isMember = task.team.members.some(member => 
      member.toString() === req.user.id
    );

    if (!isMember) {
      console.log('❌ Student not team member');
      return res.status(403).json({ 
        message: 'You are not a member of the team assigned to this task',
        success: false 
      });
    }

    console.log('✅ Student is team member');

    // Check if student has already submitted (and enforce max attempts)
    const existingSubmissions = task.submissions?.filter(sub => 
      sub.student && sub.student.toString() === req.user.id
    ) || [];

    if (existingSubmissions.length >= task.maxAttempts) {
      console.log(`❌ Max attempts (${task.maxAttempts}) reached`);
      return res.status(400).json({ 
        message: `Maximum attempts (${task.maxAttempts}) reached`,
        success: false 
      });
    }

    console.log(`✅ Attempt ${existingSubmissions.length + 1} of ${task.maxAttempts}`);

    // Check if task is overdue (unless late submissions are allowed)
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    if (now > dueDate && !task.allowLateSubmissions) {
      console.log('❌ Task is overdue and late submissions not allowed');
      return res.status(400).json({ 
        message: 'Task is overdue and late submissions are not allowed',
        success: false 
      });
    }

    // Process files if any
    const processedFiles = [];
    if (req.files && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} files`);
      
      for (const file of req.files) {
        console.log(`📎 File: ${file.originalname} (${file.size} bytes)`);
        
        // Validate file types if restrictions exist
        if (task.allowedFileTypes && task.allowedFileTypes.length > 0) {
          const ext = path.extname(file.originalname).toLowerCase().substring(1);
          if (!task.allowedFileTypes.includes(ext)) {
            console.log(`❌ File type .${ext} not allowed`);
            return res.status(400).json({
              message: `File type ".${ext}" not allowed. Allowed types: ${task.allowedFileTypes.join(', ')}`,
              success: false
            });
          }
        }
        
        // Validate file size
        if (file.size > task.maxFileSize) {
          console.log(`❌ File too large: ${file.size} > ${task.maxFileSize}`);
          return res.status(400).json({
            message: `File "${file.originalname}" is too large. Maximum size: ${Math.round(task.maxFileSize / 1024 / 1024)}MB`,
            success: false
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

    // Process collaborators
    let parsedCollaborators = [];
    if (collaborators) {
      try {
        parsedCollaborators = typeof collaborators === 'string' 
          ? JSON.parse(collaborators) 
          : collaborators;
        
        // Filter out empty emails
        parsedCollaborators = parsedCollaborators.filter(email => 
          email && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        );
      } catch (error) {
        console.log('⚠️ Error parsing collaborators:', error);
        parsedCollaborators = [];
      }
    }

    // Create submission
    const submission = {
      id: Date.now().toString(),
      student: req.user.id,
      comment: comment || '',
      files: processedFiles,
      collaborators: parsedCollaborators,
      submittedAt: new Date(),
      status: 'submitted',
      attempt: existingSubmissions.length + 1
    };

    // Add submission to task
    if (!task.submissions) {
      task.submissions = [];
    }
    task.submissions.push(submission);

    // Save task
    await task.save();

    console.log('✅ Task submitted successfully');
    console.log('📤 === TASK SUBMISSION END ===');

    res.status(201).json({
      success: true,
      message: 'Task submitted successfully',
      submission: {
        id: submission.id,
        comment: submission.comment,
        submittedAt: submission.submittedAt,
        filesCount: processedFiles.length,
        status: submission.status,
        attempt: submission.attempt
      }
    });

  } catch (error) {
    console.error('❌ Task submission error:', error);
    console.log('📤 === TASK SUBMISSION ERROR END ===');
    
    // Clean up any uploaded files if submission failed
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file: ${file.path}`);
          } catch (cleanupError) {
            console.error(`❌ Failed to cleanup file: ${file.path}`, cleanupError);
          }
        }
      });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to submit task',
      success: false 
    });
  }
});

// Get individual task details
router.get('/:taskId', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    console.log(`📋 Getting task details for: ${taskId}`);
    
    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code')
      .populate('faculty', 'firstName lastName email');

    if (!task) {
      console.log(`❌ Task not found: ${taskId}`);
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Check access permissions
    if (req.user.role === 'faculty') {
      // Faculty can only see their own tasks
      if (task.faculty._id.toString() !== req.user.id) {
        return res.status(403).json({ 
          message: 'You can only view your own tasks',
          success: false 
        });
      }
    } else if (req.user.role === 'student') {
      // Students can only see tasks for teams they're members of
      const isTeamMember = task.team.members.some(member => 
        member.toString() === req.user.id
      );
      
      if (!isTeamMember) {
        return res.status(403).json({ 
          message: 'You can only view tasks for teams you are a member of',
          success: false 
        });
      }
    }

    console.log(`✅ Task found and accessible: ${task.title}`);

    res.json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        maxPoints: task.maxPoints,
        priority: task.priority,
        allowLateSubmissions: task.allowLateSubmissions,
        maxAttempts: task.maxAttempts,
        allowFileUpload: task.allowFileUpload,
        allowedFileTypes: task.allowedFileTypes,
        maxFileSize: task.maxFileSize,
        status: task.status,
        createdAt: task.createdAt,
        team: task.team,
        server: task.server,
        faculty: task.faculty,
        submissions: task.submissions || []
      }
    });

  } catch (error) {
    console.error('❌ Get task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch task',
      success: false 
    });
  }
});

// Grade task submission
router.post('/:taskId/grade/:studentId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can grade tasks',
        success: false 
      });
    }

    const { taskId, studentId } = req.params;
    const { grade, feedback } = req.body;

    console.log(`📊 Grading task ${taskId} for student ${studentId}`);

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only grade your own tasks',
        success: false 
      });
    }

    // Find the student's submission
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
    task.submissions[submissionIndex].grade = parseFloat(grade);
    task.submissions[submissionIndex].feedback = feedback || '';
    task.submissions[submissionIndex].status = 'graded';
    task.submissions[submissionIndex].gradedAt = new Date();
    task.submissions[submissionIndex].gradedBy = req.user.id;

    await task.save();

    console.log(`✅ Task graded: ${grade}/${task.maxPoints}`);

    res.json({
      success: true,
      message: 'Task graded successfully',
      grade: parseFloat(grade),
      feedback: feedback || ''
    });

  } catch (error) {
    console.error('❌ Grade task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to grade task',
      success: false 
    });
  }
});

// Get task submissions (for faculty)
router.get('/:taskId/submissions', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can view submissions',
        success: false 
      });
    }

    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .populate('submissions.student', 'firstName lastName email')
      .populate('team', 'name members');

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

    res.json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        maxPoints: task.maxPoints,
        dueDate: task.dueDate
      },
      submissions: task.submissions
    });

  } catch (error) {
    console.error('❌ Get submissions error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch submissions',
      success: false 
    });
  }
});

// Update task
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

    console.log(`📝 Updating task ${taskId}`);

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

    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'dueDate', 'maxPoints', 'priority',
      'allowLateSubmissions', 'maxAttempts', 'allowFileUpload',
      'allowedFileTypes', 'maxFileSize', 'status'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        task[field] = updates[field];
      }
    });

    await task.save();

    console.log(`✅ Task updated: ${task.title}`);

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: {
        id: task._id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        maxPoints: task.maxPoints
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

// Delete task
router.delete('/:taskId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can delete tasks',
        success: false 
      });
    }

    const { taskId } = req.params;

    console.log(`🗑️ Deleting task ${taskId}`);

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

    // Delete associated files
    if (task.submissions && task.submissions.length > 0) {
      task.submissions.forEach(submission => {
        if (submission.files && submission.files.length > 0) {
          submission.files.forEach(file => {
            if (fs.existsSync(file.path)) {
              try {
                fs.unlinkSync(file.path);
                console.log(`🗑️ Deleted file: ${file.path}`);
              } catch (deleteError) {
                console.error(`❌ Failed to delete file: ${file.path}`, deleteError);
              }
            }
          });
        }
      });
    }

    await Task.findByIdAndDelete(taskId);

    console.log(`✅ Task deleted: ${task.title}`);

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

// Download task file
router.get('/:taskId/files/:filename', verifyToken, async (req, res) => {
  try {
    const { taskId, filename } = req.params;
    
    console.log(`📁 File download request: ${filename} for task ${taskId}`);
    
    const task = await Task.findById(taskId).populate('team', 'members');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const isTeamMember = task.team.members.some(member => 
      member.toString() === req.user.id
    );
    const isFaculty = req.user.role === 'faculty';
    
    if (!isTeamMember && !isFaculty) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filePath = path.join(__dirname, '../uploads/submissions', filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return res.status(404).json({ 
        message: 'File not found',
        success: false 
      });
    }

    console.log(`✅ Serving file: ${filename}`);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(filePath));
    
  } catch (error) {
    console.error('❌ File download error:', error);
    res.status(500).json({ 
      message: 'Failed to download file',
      success: false 
    });
  }
});

// Serve uploaded files
router.get('/files/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../uploads/submissions', filename);
  
  console.log(`📁 File request: ${filename} at ${filePath}`);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(path.resolve(filePath));
  } else {
    console.error(`❌ File not found: ${filePath}`);
    res.status(404).json({ 
      message: 'File not found',
      success: false 
    });
  }
});

// ✅ TESTING ONLY: Reset task submission attempts
router.post('/:taskId/reset-attempts', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can reset attempts',
        success: false 
      });
    }

    const { taskId } = req.params;
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only reset attempts for your own tasks',
        success: false 
      });
    }

    // Delete associated files first
    if (task.submissions && task.submissions.length > 0) {
      task.submissions.forEach(submission => {
        if (submission.files && submission.files.length > 0) {
          submission.files.forEach(file => {
            if (fs.existsSync(file.path)) {
              try {
                fs.unlinkSync(file.path);
                console.log(`🗑️ Deleted file: ${file.path}`);
              } catch (deleteError) {
                console.error(`❌ Failed to delete file: ${file.path}`, deleteError);
              }
            }
          });
        }
      });
    }

    // Remove all submissions for this task
    task.submissions = [];
    await task.save();

    console.log(`✅ Reset attempts for task: ${task.title}`);

    res.json({
      success: true,
      message: 'Task attempts reset successfully',
      taskId: taskId
    });

  } catch (error) {
    console.error('❌ Reset attempts error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to reset attempts',
      success: false 
    });
  }
});

// Debug middleware to log all file operations
router.use((req, res, next) => {
  if (req.files) {
    console.log(`📎 File upload detected on ${req.path}:`, 
      req.files.map(f => ({ name: f.originalname, size: f.size, path: f.path }))
    );
  }
  next();
});

// General error handling middleware
router.use((error, req, res, next) => {
  console.error('❌ Task routes error:', error);
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      success: false,
      errors: error.errors ? Object.keys(error.errors).map(key => error.errors[key].message) : undefined
    });
  }
  
  // Mongoose cast errors (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({ 
      message: 'Invalid ID format',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  // File upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      message: 'File too large',
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ 
      message: 'Unexpected file field',
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  // ENOENT file errors
  if (error.code === 'ENOENT') {
    return res.status(404).json({
      message: 'File not found on server',
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  // MongoDB duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res.status(409).json({ 
      message: `Duplicate entry - ${field} already exists`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  // Default error response
  res.status(500).json({ 
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    success: false,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
  });
});

console.log('✅ Task routes loaded successfully');

module.exports = router;