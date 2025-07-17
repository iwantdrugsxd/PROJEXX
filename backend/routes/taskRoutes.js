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

// Also add this debugging middleware to your taskRoutes.js:
router.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path}`);
  if (req.files && req.files.length > 0) {
    req.files.forEach(file => {
      console.log(`📎 File received: ${file.originalname}`);
      console.log(`📂 Destination: ${file.destination}`);
      console.log(`📄 Filename: ${file.filename}`);
      console.log(`📍 Full path: ${file.path}`);
      console.log(`📊 Size: ${file.size} bytes`);
    });
  }
  next();
});
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    console.log(`📎 Processing file: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
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

    res.json({ 
      success: true, 
      tasks: tasks || [],
      count: tasks.length
    });
  } catch (error) {
    console.error('Error fetching faculty tasks:', error);
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

    // Find teams the student is a member of
    const studentTeams = await StudentTeam.find({ 
      members: req.user.id 
    });

    const teamIds = studentTeams.map(team => team._id);

    // Find tasks assigned to those teams
    const tasks = await Task.find({ 
      team: { $in: teamIds }
    })
    .populate('team', 'name members')
    .populate('server', 'title code')
    .populate('faculty', 'firstName lastName email')
    .sort({ dueDate: 1 });

    res.json({ 
      success: true, 
      tasks: tasks || [],
      count: tasks.length
    });
  } catch (error) {
    console.error('Error fetching student tasks:', error);
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

    res.json({ 
      success: true, 
      tasks: tasks || [],
      serverTitle: server.title
    });
  } catch (error) {
    console.error('Error fetching server tasks:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tasks',
      success: false 
    });
  }
});

// Get teams for a server (for task creation)
// Get teams for a server (for task creation)
router.get('/server/:serverId/teams', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    console.log(`🔍 Fetching teams for server ${serverId} by ${req.user.role} ${req.user.id}`);
    
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    // Verify faculty owns the server
    if (req.user.role === 'faculty' && server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only access teams from your own servers',
        success: false 
      });
    }

    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    }).populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email');

    console.log(`📊 Found ${teams.length} teams for server ${server.code}`);

    // Always return success, even with 0 teams
    res.json({ 
      success: true, 
      teams: teams || [],
      serverCode: server.code,
      message: teams.length === 0 
        ? 'No teams found in this server. Students need to create teams first.'
        : `Found ${teams.length} teams`
    });
  } catch (error) {
    console.error('❌ Error fetching teams:', error);
    res.status(500).json({ 
      message: 'Failed to fetch teams',
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

router.post('/create', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can create tasks',
        success: false 
      });
    }

    const {
      title,
      description,
      serverId,
      dueDate,
      maxPoints,
      assignmentType,
      teamIds,
      assignToAll,
      allowLateSubmissions,
      maxAttempts,
      allowFileUpload,
      allowedFileTypes, // This should already be an array from frontend
      maxFileSize,
      priority
    } = req.body;

    console.log('📝 Creating task with data:', {
      title,
      serverId,
      assignToAll,
      teamIds,
      allowedFileTypes,
      allowedFileTypesType: typeof allowedFileTypes,
      allowedFileTypesIsArray: Array.isArray(allowedFileTypes)
    });

    // Validation
    if (!title || !description || !serverId || !dueDate) {
      return res.status(400).json({ 
        message: 'Missing required fields: title, description, serverId, dueDate',
        success: false 
      });
    }

    // Get server and verify ownership
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

    // Get teams for assignment
    let targetTeams = [];
    if (assignToAll) {
      targetTeams = await StudentTeam.find({ 
        projectServer: server.code 
      });
    } else {
      if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
        return res.status(400).json({ 
          message: 'Please select at least one team or choose "Assign to All Teams"',
          success: false 
        });
      }
      targetTeams = await StudentTeam.find({ 
        _id: { $in: teamIds },
        projectServer: server.code 
      });
    }

    if (targetTeams.length === 0) {
      return res.status(400).json({ 
        message: 'No valid teams found for assignment',
        success: false 
      });
    }

    // ✅ FIX: Handle allowedFileTypes properly - ensure it's always an array
    let processedAllowedFileTypes = [];
    if (allowFileUpload) {
      if (Array.isArray(allowedFileTypes)) {
        processedAllowedFileTypes = allowedFileTypes;
      } else if (typeof allowedFileTypes === 'string') {
        try {
          // Try to parse if it's a JSON string
          processedAllowedFileTypes = JSON.parse(allowedFileTypes);
        } catch {
          // If not JSON, split by comma
          processedAllowedFileTypes = allowedFileTypes.split(',').map(type => type.trim());
        }
      } else {
        // Default file types if none provided
        processedAllowedFileTypes = ['pdf', 'doc', 'docx'];
      }
    }

    console.log('✅ Processed allowedFileTypes:', processedAllowedFileTypes);

    // Create tasks for each team
    const createdTasks = [];
    for (const team of targetTeams) {
      const task = new Task({
        title,
        description,
        faculty: req.user.id,
        server: serverId,
        team: team._id,
        dueDate: new Date(dueDate),
        maxPoints: parseInt(maxPoints) || 100,
        allowLateSubmissions: allowLateSubmissions || false,
        maxAttempts: parseInt(maxAttempts) || 1,
        allowFileUpload: allowFileUpload || false,
        // ✅ CRITICAL: Store as array, not string
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
        allowedFileTypes: task.allowedFileTypes // Return the processed array
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



router.post('/:taskId/submit', verifyToken, upload.array('files', 10), async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Only students can submit tasks',
        success: false 
      });
    }

    const { taskId } = req.params;
    const { comment, collaborators } = req.body;

    console.log(`📤 Task submission attempt - Task: ${taskId}, Student: ${req.user.id}`);
    console.log(`📎 Files received: ${req.files ? req.files.length : 0}`);

    // Get task details first
    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code');

    if (!task) {
      // Clean up any uploaded files if task not found
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Check if student is member of the team this task is assigned to
    const isMember = task.team.members.some(member => 
      member.toString() === req.user.id
    );

    if (!isMember) {
      // Clean up uploaded files
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      return res.status(403).json({ 
        message: 'You are not a member of the team assigned to this task',
        success: false 
      });
    }

    // ✅ CRITICAL FIX: Verify uploaded files exist before processing
    const validFiles = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        console.log(`🔍 Checking file: ${file.path}`);
        
        if (fs.existsSync(file.path)) {
          console.log(`✅ File exists: ${file.originalname}`);
          
          // Validate file types if restrictions exist
          if (task.allowedFileTypes && task.allowedFileTypes.length > 0) {
            const ext = path.extname(file.originalname).toLowerCase().substring(1);
            if (!task.allowedFileTypes.includes(ext)) {
              console.log(`❌ File type .${ext} not allowed`);
              fs.unlinkSync(file.path); // Remove invalid file
              continue;
            }
          }
          
          validFiles.push({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date()
          });
        } else {
          console.error(`❌ File not found at path: ${file.path}`);
          return res.status(400).json({
            success: false,
            message: `File "${file.originalname}" was not properly uploaded. Please try again.`
          });
        }
      }
    }

    console.log(`📁 Valid files processed: ${validFiles.length}`);

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
      } catch (e) {
        console.log('Could not parse collaborators:', e);
        parsedCollaborators = [];
      }
    }

    // Check if student has already submitted (and handle multiple attempts)
    const existingSubmissions = task.submissions.filter(sub => 
      sub.student.toString() === req.user.id
    );

    if (existingSubmissions.length >= task.maxAttempts) {
      // Clean up uploaded files
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      return res.status(400).json({ 
        message: `Maximum attempts (${task.maxAttempts}) reached`,
        success: false 
      });
    }

    // Create submission object
    const submission = {
      student: req.user.id,
      comment: comment || '',
      submittedAt: new Date(),
      status: 'submitted',
      isLate: new Date() > task.dueDate,
      attemptNumber: existingSubmissions.length + 1,
      collaborators: parsedCollaborators,
      files: validFiles
    };

    // Add submission to task
    task.submissions.push(submission);
    await task.save();

    console.log(`✅ Task ${taskId} submitted successfully by student ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Task submitted successfully',
      submission: {
        id: submission._id || Date.now().toString(),
        comment: submission.comment,
        submittedAt: submission.submittedAt,
        filesCount: validFiles.length,
        status: 'submitted'
      }
    });

  } catch (error) {
    console.error('❌ Submit task error:', error);
    
    // Clean up any uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            console.log(`🧹 Cleaned up file: ${file.filename}`);
          } catch (cleanupError) {
            console.error(`❌ Failed to clean up file: ${file.filename}`, cleanupError);
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

// 4. Add a route to serve uploaded files
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

// 5. Debug middleware to log all file operations
router.use((req, res, next) => {
  if (req.files) {
    console.log(`📎 File upload detected on ${req.path}:`, 
      req.files.map(f => ({ name: f.originalname, size: f.size, path: f.path }))
    );
  }
  next();
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
      return res.status(404).json({ 
        message: 'File not found',
        success: false 
      });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
    
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ 
      message: 'Failed to download file',
      success: false 
    });
  }
});

module.exports = router;