// ===== backend/routes/taskRoutes.js (COMPLETE FIXED FILE) =====
const express = require('express');
const router = express.Router();
const Task = require('../models/taskSchema');
const StudentTeam = require('../models/studentTeamSchema');
const Student = require('../models/studentSchema');
const ProjectServer = require('../models/projectServerSchema');
const verifyToken = require('../middleware/verifyToken');
const NotificationService = require('../services/notificationService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

console.log('🔧 taskRoutes.js loaded');

// ✅ FIXED: Enhanced directory creation with error handling
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
    console.error('File download error:', error);
    res.status(500).json({ 
      message: 'Failed to download file',
      success: false 
    });
  }
});

// ✅ Grade task submission
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

    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code');

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

    // Find the submission
    const submission = task.submissions.find(sub => 
      sub.student.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({ 
        message: 'Submission not found',
        success: false 
      });
    }

    // Validate grade
    if (grade < 0 || grade > task.maxPoints) {
      return res.status(400).json({ 
        message: `Grade must be between 0 and ${task.maxPoints}`,
        success: false 
      });
    }

    // Update submission
    submission.grade = grade;
    submission.feedback = feedback || '';
    submission.status = 'graded';
    submission.gradedAt = new Date();
    submission.gradedBy = req.user.id;

    await task.save();

    console.log(`✅ Task ${taskId} graded for student ${studentId} by faculty ${req.user.id}`);

    res.json({
      success: true,
      message: 'Task graded successfully',
      submission: {
        grade: submission.grade,
        feedback: submission.feedback,
        gradedAt: submission.gradedAt
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

// ✅ Get task submissions (for faculty)
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
      .populate('team', 'name members')
      .populate('server', 'title code')
      .populate('submissions.student', 'firstName lastName email');

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns this task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only view submissions for your own tasks',
        success: false 
      });
    }

    const submissions = task.submissions.map(submission => ({
      id: submission._id,
      student: {
        id: submission.student._id,
        name: `${submission.student.firstName} ${submission.student.lastName}`,
        email: submission.student.email
      },
      submittedAt: submission.submittedAt,
      status: submission.status,
      comment: submission.comment,
      files: submission.files.map(file => ({
        originalName: file.originalName,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      })),
      collaborators: submission.collaborators,
      grade: submission.grade,
      feedback: submission.feedback,
      gradedAt: submission.gradedAt,
      attemptNumber: submission.attemptNumber,
      isLate: submission.isLate
    }));

    res.json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        description: task.description,
        maxPoints: task.maxPoints,
        dueDate: task.dueDate,
        team: task.team.name
      },
      submissions,
      totalSubmissions: submissions.length,
      gradedSubmissions: submissions.filter(s => s.status === 'graded').length,
      pendingSubmissions: submissions.filter(s => s.status === 'submitted').length
    });

  } catch (error) {
    console.error('❌ Get submissions error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch submissions',
      success: false 
    });
  }
});

// ✅ Update task
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

    // Verify faculty owns this task
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

    console.log(`✅ Task ${taskId} updated by faculty ${req.user.id}`);

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: {
        id: task._id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        maxPoints: task.maxPoints,
        allowedFileTypes: task.allowedFileTypes
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

// ✅ Delete task
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

    // Verify faculty owns this task
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
            const filePath = file.path;
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Deleted file: ${filePath}`);
              } catch (deleteError) {
                console.error(`❌ Failed to delete file: ${filePath}`, deleteError);
              }
            }
          });
        }
      });
    }

    await Task.findByIdAndDelete(taskId);

    console.log(`✅ Task ${taskId} deleted by faculty ${req.user.id}`);

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

module.exports = router;(error) {
    console.error('❌ Error creating directories:', error);
    res.status(500).json({
      message: 'Failed to create upload directories',
      success: false
    });
  }
;

// Use directory middleware for all routes
router.use(ensureUploadsDirectory);

// ✅ CRITICAL FIX: Robust filename sanitization to prevent ENOENT errors
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads/submissions');
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase();
      
      // ✅ ROBUST FILENAME SANITIZATION - This fixes the ENOENT error
      let baseName = path.basename(file.originalname, path.extname(file.originalname));
      
      // Remove or replace problematic characters
      baseName = baseName
        .normalize('NFD') // Normalize unicode
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Replace spaces and special chars with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .substring(0, 50) // Limit length to prevent long filename issues
        .toLowerCase(); // Convert to lowercase for consistency
      
      // Ensure we have a valid base name
      if (!baseName || baseName.length === 0) {
        baseName = 'file';
      }
      
      const safeFilename = `${baseName}_${uniqueSuffix}${ext}`;
      
      console.log(`📁 File upload - Original: "${file.originalname}"`);
      console.log(`📁 File upload - Sanitized: "${safeFilename}"`);
      console.log(`📁 File upload - Full path will be: "${path.join(__dirname, '../uploads/submissions', safeFilename)}"`);
      
      cb(null, safeFilename);
    } catch (error) {
      console.error('❌ Error generating safe filename:', error);
      // Fallback to timestamp-only filename if sanitization fails
      const fallbackName = `file_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname).toLowerCase()}`;
      console.log(`📁 Using fallback filename: ${fallbackName}`);
      cb(null, fallbackName);
    }
  }
});

// ✅ FIXED: Enhanced file filter with better error messages
const fileFilter = (req, file, cb) => {
  console.log(`🔍 Validating file: ${file.originalname}, MIME: ${file.mimetype}`);
  
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    console.log(`✅ File type accepted: ${file.mimetype}`);
    cb(null, true);
  } else {
    console.log(`❌ File type rejected: ${file.mimetype}`);
    const error = new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedTypes.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// ✅ FIXED: Enhanced multer configuration with better error handling
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10, // Maximum 10 files
    fields: 20 // Maximum 20 form fields
  },
  onError: (err, next) => {
    console.error('❌ Multer error:', err);
    next(err);
  }
});

// ✅ Create task
router.post('/create', verifyToken, async (req, res) => {
  console.log('🎯 CREATE TASK route hit');
  console.log('Request body:', req.body);
  
  try {
    const { 
      title, 
      description, 
      serverId, 
      teamIds, 
      dueDate, 
      maxPoints,
      assignToAll,
      assignmentType = 'team',
      allowFileUpload,
      allowedFileTypes,
      maxFileSize,
      allowLateSubmissions,
      maxAttempts,
      priority
    } = req.body;
    
    console.log('Extracted allowedFileTypes:', allowedFileTypes);
    
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can create tasks',
        success: false 
      });
    }

    if (!title?.trim() || !description?.trim() || !serverId || !dueDate) {
      return res.status(400).json({ 
        message: 'Missing required fields: title, description, server, or due date',
        success: false 
      });
    }

    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Project server not found',
        success: false 
      });
    }

    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only create tasks for your own servers',
        success: false 
      });
    }

    const validFileTypes = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'zip', 'rar'];
    let finalAllowedFileTypes = [];
    
    if (allowFileUpload && Array.isArray(allowedFileTypes) && allowedFileTypes.length > 0) {
      finalAllowedFileTypes = allowedFileTypes.filter(type => validFileTypes.includes(type));
      
      console.log('Final allowed file types:', finalAllowedFileTypes);
      
      if (finalAllowedFileTypes.length === 0) {
        return res.status(400).json({ 
          message: 'No valid file types selected',
          success: false,
          received: allowedFileTypes,
          valid: validFileTypes
        });
      }
    }

    let targetTeams;
    if (assignToAll) {
      targetTeams = await StudentTeam.find({ 
        projectServer: server.code 
      }).populate('members', '_id firstName lastName email');
    } else {
      if (!teamIds || teamIds.length === 0) {
        return res.status(400).json({ 
          message: 'Please select at least one team or choose "Assign to All Teams"',
          success: false 
        });
      }

      targetTeams = await StudentTeam.find({ 
        _id: { $in: teamIds },
        projectServer: server.code 
      }).populate('members', '_id firstName lastName email');

      if (targetTeams.length !== teamIds.length) {
        return res.status(400).json({ 
          message: 'Some selected teams were not found in this server',
          success: false 
        });
      }
    }

    if (targetTeams.length === 0) {
      return res.status(400).json({ 
        message: 'No teams found in this server. Students need to create teams first.',
        success: false 
      });
    }

    const createdTasks = [];
    
    for (const team of targetTeams) {
      const taskData = {
        title: title.trim(),
        description: description.trim(),
        server: serverId,
        team: team._id,
        faculty: req.user.id,
        assignmentType: assignmentType,
        dueDate: new Date(dueDate),
        maxPoints: maxPoints || 100,
        status: 'active',
        isVisible: true,
        publishedAt: new Date(),
        allowFileUpload: Boolean(allowFileUpload),
        allowedFileTypes: finalAllowedFileTypes,
        maxFileSize: maxFileSize || 10485760,
        allowLateSubmissions: Boolean(allowLateSubmissions),
        maxAttempts: maxAttempts || 1,
        priority: priority || 'medium'
      };

      console.log('Creating task with data:', taskData);
      console.log('Task allowedFileTypes:', taskData.allowedFileTypes);

      const task = new Task(taskData);
      await task.save();
      
      console.log('Saved task allowedFileTypes:', task.allowedFileTypes);
      
      createdTasks.push(task);
      
      if (NotificationService && NotificationService.notifyTaskAssigned) {
        try {
          await NotificationService.notifyTaskAssigned(task, team, server);
        } catch (notifError) {
          console.warn('Failed to send notification:', notifError);
        }
      }
    }

    console.log(`✅ Created ${createdTasks.length} tasks for faculty ${req.user.id}`);
    
    createdTasks.forEach(task => {
      console.log(`Task ${task._id} - allowedFileTypes:`, task.allowedFileTypes);
    });

    res.status(201).json({
      success: true,
      message: `Created ${createdTasks.length} task${createdTasks.length > 1 ? 's' : ''} successfully`,
      tasks: createdTasks.map(task => ({
        id: task._id,
        title: task.title,
        teamName: task.team?.name || 'Unknown Team',
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

// ✅ Get tasks for faculty
router.get('/faculty-tasks', verifyToken, async (req, res) => {
  console.log('🎯 GET FACULTY TASKS route hit');

  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Access denied. Faculty access required.',
        success: false 
      });
    }

    const tasks = await Task.find({ faculty: req.user.id })
      .populate('server', 'title code')
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const tasksWithStats = tasks.map(task => {
      const taskObj = task.toObject();
      taskObj.totalSubmissions = task.submissions.length;
      taskObj.pendingSubmissions = task.submissions.filter(s => s.status === 'submitted').length;
      taskObj.gradedSubmissions = task.submissions.filter(s => s.status === 'graded').length;
      return taskObj;
    });

    console.log(`✅ Found ${tasks.length} tasks for faculty ${req.user.id}`);
    res.json({ 
      success: true, 
      tasks: tasksWithStats,
      message: tasks.length === 0 ? 'No tasks created yet' : `Found ${tasks.length} tasks`
    });
  } catch (error) {
    console.error('❌ Get faculty tasks error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch tasks',
      success: false 
    });
  }
});

// ✅ Get tasks for student (based on team membership)
router.get('/student-tasks', verifyToken, async (req, res) => {
  console.log('🎯 GET STUDENT TASKS route hit');
  console.log('User:', req.user);

  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Access denied. Student access required.',
        success: false 
      });
    }

    const studentTeams = await StudentTeam.find({ 
      members: req.user.id 
    }).select('_id');

    const teamIds = studentTeams.map(team => team._id);

    if (teamIds.length === 0) {
      return res.json({ 
        success: true, 
        tasks: [],
        message: 'No tasks found. Create or join a team to see assigned tasks.',
        info: 'Tasks are assigned to teams, not individual server members'
      });
    }

    const tasks = await Task.find({ 
      team: { $in: teamIds },
      status: 'active'
    })
    .populate('server', 'title code')
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email')
    .sort({ createdAt: -1 });

    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      const submission = task.submissions.find(sub => 
        sub.student.toString() === req.user.id
      );
      
      taskObj.submissionStatus = submission ? submission.status : 'pending';
      taskObj.submissionDate = submission ? submission.submittedAt : null;
      taskObj.grade = submission ? submission.grade : null;
      taskObj.feedback = submission ? submission.feedback : null;
      
      return taskObj;
    });

    console.log(`✅ Found ${tasks.length} tasks for student ${req.user.id} based on team membership`);
    res.json({ 
      success: true, 
      tasks: tasksWithStatus,
      teamsCount: teamIds.length,
      message: tasks.length === 0 ? 'No tasks assigned to your teams yet' : `Found ${tasks.length} tasks`
    });
  } catch (error) {
    console.error('❌ Get student tasks error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch tasks',
      success: false 
    });
  }
});

// ✅ FIXED: Submit task with comprehensive file handling and ENOENT prevention
router.post('/:taskId/submit', verifyToken, upload.array('files', 10), async (req, res) => {
  console.log('🎯 TASK SUBMISSION route hit');
  console.log('Task ID:', req.params.taskId);
  console.log('User:', req.user);
  console.log('Files uploaded:', req.files?.length || 0);
  
  // ✅ CRITICAL: Log file details with existence check
  if (req.files) {
    req.files.forEach((file, index) => {
      const fileExists = fs.existsSync(file.path);
      console.log(`📄 File ${index + 1}:`, {
        originalname: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        exists: fileExists ? '✅' : '❌'
      });
      
      if (!fileExists) {
        console.error(`❌ CRITICAL: File does not exist immediately after upload: ${file.path}`);
      }
    });
  }

  try {
    if (req.user.role !== 'student') {
      // Cleanup files if user is not student
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file (unauthorized): ${file.path}`);
          }
        });
      }
      return res.status(403).json({ 
        message: 'Only students can submit tasks',
        success: false 
      });
    }

    const { taskId } = req.params;
    const { comment, collaborators } = req.body;

    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code');

    if (!task) {
      // Cleanup files if task not found
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file (task not found): ${file.path}`);
          }
        });
      }
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // ✅ ENHANCED: Validate file uploads against task settings
    if (req.files && req.files.length > 0) {
      console.log('📁 Task allows file upload:', task.allowFileUpload);
      console.log('📁 Task allowed types:', task.allowedFileTypes);
      
      if (!task.allowFileUpload) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file (uploads not allowed): ${file.path}`);
          }
        });
        return res.status(400).json({
          message: 'File uploads are not allowed for this task',
          success: false
        });
      }

      // Validate file types against task settings
      if (task.allowedFileTypes && task.allowedFileTypes.length > 0) {
        for (const file of req.files) {
          const fileExtension = path.extname(file.originalname).toLowerCase().replace('.', '');
          
          console.log(`🔍 Checking file: ${file.originalname}, extension: ${fileExtension}`);
          console.log(`🔍 Allowed types: ${task.allowedFileTypes}`);
          
          if (!task.allowedFileTypes.includes(fileExtension)) {
            req.files.forEach(f => {
              if (fs.existsSync(f.path)) {
                fs.unlinkSync(f.path);
                console.log(`🗑️ Cleaned up file (invalid type): ${f.path}`);
              }
            });
            
            return res.status(400).json({
              message: `File type '${fileExtension}' is not allowed for this task. Allowed types: ${task.allowedFileTypes.join(', ')}`,
              success: false,
              allowedTypes: task.allowedFileTypes,
              rejectedFile: file.originalname
            });
          }
        }
      }
    }

    // Check if student is part of the assigned team
    const isTeamMember = task.team.members.some(member => 
      member.toString() === req.user.id
    );

    if (!isTeamMember) {
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file (not team member): ${file.path}`);
          }
        });
      }
      return res.status(403).json({ 
        message: 'You can only submit tasks assigned to your teams',
        success: false 
      });
    }

    // Check if task is still active and not overdue
    if (task.status !== 'active') {
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file (task not active): ${file.path}`);
          }
        });
      }
      return res.status(400).json({ 
        message: 'Task is not active',
        success: false 
      });
    }

    if (new Date() > task.dueDate && !task.allowLateSubmissions) {
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file (past deadline): ${file.path}`);
          }
        });
      }
      return res.status(400).json({ 
        message: 'Task submission deadline has passed',
        success: false 
      });
    }

    // Check if student has already submitted
    const existingSubmission = task.submissions.find(sub => 
      sub.student.toString() === req.user.id
    );

    if (existingSubmission && task.maxAttempts === 1) {
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file (already submitted): ${file.path}`);
          }
        });
      }
      return res.status(400).json({ 
        message: 'You have already submitted this task',
        success: false 
      });
    }

    // Check attempt limit
    const studentSubmissions = task.submissions.filter(sub => 
      sub.student.toString() === req.user.id
    );

    if (studentSubmissions.length >= task.maxAttempts) {
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file (max attempts reached): ${file.path}`);
          }
        });
      }
      return res.status(400).json({ 
        message: `Maximum attempts (${task.maxAttempts}) reached`,
        success: false 
      });
    }

    // ✅ CRITICAL: Process files safely with double-check for existence
    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Double-check file exists before processing
        if (!fs.existsSync(file.path)) {
          console.error(`❌ CRITICAL: File not found during processing: ${file.path}`);
          // Cleanup other files
          uploadedFiles.forEach(f => {
            if (fs.existsSync(f.path)) {
              fs.unlinkSync(f.path);
            }
          });
          req.files.forEach(f => {
            if (fs.existsSync(f.path)) {
              fs.unlinkSync(f.path);
            }
          });
          return res.status(500).json({
            message: `Uploaded file ${file.originalname} was not found on server. This may be due to filename issues.`,
            success: false,
            hint: 'Try uploading files with simple names (no spaces or special characters)'
          });
        }

        // Verify file is readable
        try {
          const stats = fs.statSync(file.path);
          console.log(`📊 File stats: ${file.filename} - ${stats.size} bytes`);
        } catch (statError) {
          console.error(`❌ Cannot read file stats: ${file.path}`, statError);
          continue; // Skip this file but don't fail entirely
        }

        uploadedFiles.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype
        });
        
        console.log(`✅ File processed successfully: ${file.filename}`);
      }
    }

    // Process collaborators
    let parsedCollaborators = [];
    if (collaborators) {
      try {
        parsedCollaborators = typeof collaborators === 'string' 
          ? JSON.parse(collaborators) 
          : collaborators;
      } catch (e) {
        console.log('Could not parse collaborators:', e);
      }
    }

    // Create submission
    const submission = {
      student: req.user.id,
      comment: comment || '',
      submittedAt: new Date(),
      status: 'submitted',
      isLate: new Date() > task.dueDate,
      attemptNumber: studentSubmissions.length + 1,
      collaborators: parsedCollaborators,
      files: uploadedFiles
    };

    task.submissions.push(submission);
    await task.save();

    console.log(`✅ Task ${taskId} submitted by student ${req.user.id}`);
    console.log(`✅ Files uploaded and saved: ${uploadedFiles.length}`);
    
    // Log final file locations for verification
    uploadedFiles.forEach(file => {
      console.log(`📍 Final file location: ${file.path} (exists: ${fs.existsSync(file.path) ? '✅' : '❌'})`);
    });

    res.status(201).json({
      success: true,
      message: 'Task submitted successfully',
      submission: {
        id: submission._id || 'generated',
        comment: submission.comment,
        submittedAt: submission.submittedAt,
        filesCount: uploadedFiles.length,
        files: uploadedFiles.map(f => ({
          originalName: f.originalName,
          filename: f.filename,
          size: f.size
        }))
      }
    });

  } catch (error) {
    console.error('❌ Submit task error:', error);
    
    // ✅ COMPREHENSIVE: Cleanup uploaded files if submission failed
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file after error: ${file.path}`);
          } catch (unlinkError) {
            console.error('❌ Error cleaning up file:', unlinkError);
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

// ✅ Get teams for a server (for task creation)
router.get('/server/:serverId/teams', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    }).populate('members', 'firstName lastName email');

    res.json({ 
      success: true, 
      teams: teams || [],
      serverCode: server.code
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ 
      message: 'Failed to fetch teams',
      success: false 
    });
  }
});


// ✅ Download task file
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
      console.error(`❌ File not found: ${filePath}`);
      return res.status(404).json({ 
        message: 'File not found on server',
        success: false 
      });
    }

    const stats = fs.statSync(filePath);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ 
      message: 'Failed to download file',
      success: false 
    });
  }
});

module.exports = router;