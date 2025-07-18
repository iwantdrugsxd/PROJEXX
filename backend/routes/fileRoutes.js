// backend/routes/fileRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const verifyToken = require('../middleware/verifyToken');
const mongoose = require('mongoose');
const router = express.Router();
// Add these enhancements to your existing taskRoutes.js file

// Enhanced logging function - ADD THIS AT THE TOP
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

// Enhanced multer error handler - ADD THIS FUNCTION
const handleMulterError = (error, req, res, reject) => {
  logWithTimestamp('error', 'Multer error occurred', {
    error: error.message,
    code: error.code,
    field: error.field,
    originalUrl: req.originalUrl,
    method: req.method
  });

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size exceeded.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 10 files allowed.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field.'
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Upload error: ${error.message}`
        });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: error.message || 'File upload failed'
    });
  }
};

// REPLACE your existing submit route with this enhanced version:
router.post('/tasks/:taskId/submit', verifyToken, async (req, res) => {
  const submissionId = uuidv4();
  
  logWithTimestamp('info', '=== TASK SUBMISSION START ===', {
    submissionId,
    taskId: req.params.taskId,
    userId: req.user?.id,
    userRole: req.user?.role,
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
        message: 'Access denied. Student access required.'
      });
    }

    // Find and validate task
    logWithTimestamp('info', 'Looking up task', { taskId: req.params.taskId });
    const task = await Task.findById(req.params.taskId).populate('teams');
    
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
      teamsCount: task.teams?.length || 0
    });

    // Check if student is assigned to this task
    const studentTeams = task.teams.filter(team => 
      team.members.some(member => member.toString() === req.user.id)
    );

    if (studentTeams.length === 0) {
      logWithTimestamp('error', 'Student not assigned to task', {
        studentId: req.user.id,
        taskId: task._id,
        availableTeams: task.teams.map(t => t._id)
      });
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this task'
      });
    }

    logWithTimestamp('info', 'Student assignment verified', {
      studentId: req.user.id,
      assignedTeams: studentTeams.length
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

    // Set up multer with task-specific settings
    req.allowedFileTypes = task.allowedFileTypes;
    req.maxFileSize = task.maxFileSize;
    
    logWithTimestamp('info', 'Setting up file upload middleware', {
      allowedFileTypes: task.allowedFileTypes,
      maxFileSize: task.maxFileSize,
      allowFileUpload: task.allowFileUpload
    });
    
    const uploadMiddleware = upload.array('files', 10);
    
    // Handle file upload with enhanced error handling
    await new Promise((resolve, reject) => {
      uploadMiddleware(req, res, (error) => {
        if (error) {
          logWithTimestamp('error', 'File upload middleware error', {
            error: error.message,
            code: error.code,
            field: error.field
          });
          handleMulterError(error, req, res, reject);
        } else {
          logWithTimestamp('info', 'File upload middleware completed successfully', {
            filesCount: req.files?.length || 0
          });
          resolve();
        }
      });
    });

    logWithTimestamp('info', 'Files uploaded successfully', {
      filesCount: req.files?.length || 0,
      files: req.files?.map(f => ({
        originalname: f.originalname,
        filename: f.filename,
        size: f.size,
        mimetype: f.mimetype
      })) || []
    });

    // Process form data
    const comment = req.body.comment?.trim() || '';
    let collaborators = [];
    
    logWithTimestamp('info', 'Processing form data', {
      comment: comment ? 'provided' : 'empty',
      rawCollaborators: req.body.collaborators
    });
    
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
          
        logWithTimestamp('info', 'Collaborators processed', {
          originalCount: req.body.collaborators.length,
          validCount: collaborators.length,
          collaborators: collaborators
        });
      }
    } catch (error) {
      logWithTimestamp('warn', 'Error parsing collaborators', {
        error: error.message,
        rawCollaborators: req.body.collaborators
      });
      collaborators = [];
    }

    // Process uploaded files with enhanced validation
    const processedFiles = [];
    if (req.files && req.files.length > 0) {
      logWithTimestamp('info', 'Processing uploaded files', {
        filesCount: req.files.length
      });

      for (const [index, file] of req.files.entries()) {
        logWithTimestamp('info', `Processing file ${index + 1}`, {
          originalname: file.originalname,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path
        });

        // Validate file size against task limit
        if (file.size > task.maxFileSize) {
          logWithTimestamp('error', 'File exceeds size limit', {
            filename: file.originalname,
            fileSize: file.size,
            maxSize: task.maxFileSize
          });

          // Clean up file
          try {
            await fs.unlink(file.path);
            logWithTimestamp('info', 'Cleaned up oversized file', { path: file.path });
          } catch (cleanupError) {
            logWithTimestamp('error', 'Failed to cleanup oversized file', {
              path: file.path,
              error: cleanupError.message
            });
          }
          
          return res.status(400).json({
            success: false,
            message: `File ${file.originalname} exceeds size limit of ${Math.round(task.maxFileSize / 1024 / 1024)}MB`
          });
        }

        // Validate file type
        const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
        if (task.allowedFileTypes && task.allowedFileTypes.length > 0) {
          if (!task.allowedFileTypes.includes(fileExtension)) {
            logWithTimestamp('error', 'File type not allowed', {
              filename: file.originalname,
              extension: fileExtension,
              allowedTypes: task.allowedFileTypes
            });

            // Clean up file
            try {
              await fs.unlink(file.path);
              logWithTimestamp('info', 'Cleaned up invalid file type', { path: file.path });
            } catch (cleanupError) {
              logWithTimestamp('error', 'Failed to cleanup invalid file', {
                path: file.path,
                error: cleanupError.message
              });
            }

            return res.status(400).json({
              success: false,
              message: `File type .${fileExtension} not allowed. Allowed types: ${task.allowedFileTypes.join(', ')}`
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
          await fs.unlink(file.path);
          logWithTimestamp('info', 'Cleaned up file', { path: file.path });
        } catch (cleanupError) {
          logWithTimestamp('error', 'Failed to cleanup file', {
            path: file.path,
            error: cleanupError.message
          });
        }
      }
    }
    
    logWithTimestamp('info', '=== TASK SUBMISSION ERROR END ===');
    
    res.status(500).json({ 
      message: error.message || 'Failed to submit task',
      success: false 
    });
  }
});

// ADD this debugging route to test file upload endpoint
router.options('/tasks/:taskId/submit', verifyToken, (req, res) => {
  logWithTimestamp('info', 'OPTIONS request for submit endpoint', {
    taskId: req.params.taskId,
    userId: req.user?.id
  });
  
  res.status(200).json({
    success: true,
    message: 'Submit endpoint is available',
    methods: ['POST'],
    accepts: ['multipart/form-data'],
    taskId: req.params.taskId
  });
});

// ADD this route to check task existence and permissions
router.get('/tasks/:taskId/check', verifyToken, async (req, res) => {
  try {
    logWithTimestamp('info', 'Task check request', {
      taskId: req.params.taskId,
      userId: req.user?.id
    });

    const task = await Task.findById(req.params.taskId).populate('teams');
    
    if (!task) {
      logWithTimestamp('error', 'Task not found in check', { taskId: req.params.taskId });
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check student assignment
    const studentTeams = task.teams.filter(team => 
      team.members.some(member => member.toString() === req.user.id)
    );

    const isAssigned = studentTeams.length > 0;
    
    logWithTimestamp('info', 'Task check completed', {
      taskId: task._id,
      title: task.title,
      isAssigned: isAssigned,
      allowFileUpload: task.allowFileUpload,
      studentTeams: studentTeams.length
    });

    res.json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        allowFileUpload: task.allowFileUpload,
        maxFileSize: task.maxFileSize,
        allowedFileTypes: task.allowedFileTypes,
        isAssigned: isAssigned,
        teamsCount: task.teams.length,
        assignedTeams: studentTeams.length
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

// File metadata schema (if using MongoDB)
const FileSchema = {
  filename: String,
  originalName: String,
  path: String,
  size: Number,
  mimetype: String,
  uploadedBy: String,
  taskId: String,
  studentId: String,
  uploadedAt: Date,
  isActive: Boolean,
  downloadCount: Number,
  versions: Array
};

// In-memory file store (replace with database in production)
let fileStore = {};

// ✅ Upload single or multiple files
router.post('/upload', verifyToken, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const { taskId, studentId, userRole } = req.body;
    const uploadedFiles = [];

    for (const file of req.files) {
      const fileId = crypto.randomUUID();
      const fileData = {
        id: fileId,
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        uploadedBy: req.user.id,
        userRole: req.user.role,
        taskId: taskId || null,
        studentId: studentId || null,
        uploadedAt: new Date(),
        isActive: true,
        downloadCount: 0,
        versions: []
      };

      // Store file metadata (in production, save to database)
      fileStore[fileId] = fileData;
      
      uploadedFiles.push({
        id: fileId,
        name: file.originalname,
        size: file.size,
        url: `/api/files/${fileId}`,
        downloadUrl: `/api/files/${fileId}/download`
      });

      console.log(`📎 File uploaded: ${file.originalname} (${fileData.size} bytes) by ${req.user.role} ${req.user.id}`);
    }

    res.json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'File upload failed'
    });
  }
});

// ✅ Get file information
router.get('/:fileId', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = fileStore[fileId];

    if (!file || !file.isActive) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if user has permission to access this file
    const hasPermission = (
      req.user.role === 'faculty' || // Faculty can access all files
      file.uploadedBy === req.user.id || // User can access their own files
      file.studentId === req.user.id // Student can access files assigned to them
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      file: {
        id: file.id,
        name: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: file.uploadedAt,
        downloadCount: file.downloadCount,
        uploadedBy: file.uploadedBy,
        userRole: file.userRole
      }
    });

  } catch (error) {
    console.error('❌ Get file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve file information'
    });
  }
});

// ✅ Download file
router.get('/:fileId/download', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = fileStore[fileId];

    if (!file || !file.isActive) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permissions
    const hasPermission = (
      req.user.role === 'faculty' ||
      file.uploadedBy === req.user.id ||
      file.studentId === req.user.id
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Increment download count
    fileStore[fileId].downloadCount++;

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Length', file.size);

    // Stream the file
    const fileStream = fs.createReadStream(file.path);
    fileStream.pipe(res);

    console.log(`📥 File downloaded: ${file.originalName} by ${req.user.role} ${req.user.id}`);

  } catch (error) {
    console.error('❌ File download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

// ✅ Delete file
router.delete('/:fileId', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = fileStore[fileId];

    if (!file || !file.isActive) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permissions (only file owner or faculty can delete)
    const canDelete = (
      req.user.role === 'faculty' ||
      file.uploadedBy === req.user.id
    );

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Mark file as inactive (soft delete)
    fileStore[fileId].isActive = false;

    // Optionally delete from disk (uncomment for hard delete)
    // if (fs.existsSync(file.path)) {
    //   fs.unlinkSync(file.path);
    // }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

    console.log(`🗑️ File deleted: ${file.originalName} by ${req.user.role} ${req.user.id}`);

  } catch (error) {
    console.error('❌ File delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

// ✅ Get files for a specific task
router.get('/task/:taskId', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Filter files by task ID
    const taskFiles = Object.values(fileStore).filter(file => 
      file.taskId === taskId && file.isActive
    );

    // Check permissions based on user role
    let filteredFiles = taskFiles;
    
    if (req.user.role === 'student') {
      // Students can only see their own files for this task
      filteredFiles = taskFiles.filter(file => 
        file.uploadedBy === req.user.id || file.studentId === req.user.id
      );
    }
    // Faculty can see all files for the task

    const filesResponse = filteredFiles.map(file => ({
      id: file.id,
      name: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: file.uploadedAt,
      uploadedBy: file.uploadedBy,
      userRole: file.userRole,
      downloadCount: file.downloadCount
    }));

    res.json({
      success: true,
      files: filesResponse,
      count: filesResponse.length
    });

  } catch (error) {
    console.error('❌ Get task files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve task files'
    });
  }
});

// ✅ Get user's uploaded files
router.get('/user/my-files', verifyToken, async (req, res) => {
  try {
    const userFiles = Object.values(fileStore).filter(file => 
      file.uploadedBy === req.user.id && file.isActive
    );

    const filesResponse = userFiles.map(file => ({
      id: file.id,
      name: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: file.uploadedAt,
      taskId: file.taskId,
      downloadCount: file.downloadCount
    }));

    res.json({
      success: true,
      files: filesResponse,
      count: filesResponse.length
    });

  } catch (error) {
    console.error('❌ Get user files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user files'
    });
  }
});

// ✅ Update file metadata (rename, etc.)
router.patch('/:fileId', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { newName, description } = req.body;
    const file = fileStore[fileId];

    if (!file || !file.isActive) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permissions
    const canEdit = (
      req.user.role === 'faculty' ||
      file.uploadedBy === req.user.id
    );

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update metadata
    if (newName) {
      // Validate new name
      if (newName.trim().length === 0 || newName.length > 255) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file name'
        });
      }
      fileStore[fileId].originalName = newName.trim();
    }

    if (description !== undefined) {
      fileStore[fileId].description = description;
    }

    res.json({
      success: true,
      message: 'File updated successfully',
      file: {
        id: file.id,
        name: file.originalName,
        description: file.description
      }
    });

  } catch (error) {
    console.error('❌ Update file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file'
    });
  }
});

// ✅ Get file statistics
router.get('/stats/overview', verifyToken, async (req, res) => {
  try {
    const activeFiles = Object.values(fileStore).filter(file => file.isActive);
    
    let userFiles = activeFiles;
    if (req.user.role === 'student') {
      userFiles = activeFiles.filter(file => 
        file.uploadedBy === req.user.id || file.studentId === req.user.id
      );
    }

    const stats = {
      totalFiles: userFiles.length,
      totalSize: userFiles.reduce((sum, file) => sum + file.size, 0),
      totalDownloads: userFiles.reduce((sum, file) => sum + file.downloadCount, 0),
      fileTypes: {},
      recentUploads: userFiles
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .slice(0, 5)
        .map(file => ({
          id: file.id,
          name: file.originalName,
          size: file.size,
          uploadedAt: file.uploadedAt
        }))
    };

    // Calculate file type distribution
    userFiles.forEach(file => {
      const ext = path.extname(file.originalName).toLowerCase().substring(1);
      stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
    });

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Get file stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve file statistics'
    });
  }
});

// ✅ Search files
router.get('/search/:query', verifyToken, async (req, res) => {
  try {
    const { query } = req.params;
    const { type, taskId } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    let searchFiles = Object.values(fileStore).filter(file => file.isActive);

    // Filter by user permissions
    if (req.user.role === 'student') {
      searchFiles = searchFiles.filter(file => 
        file.uploadedBy === req.user.id || file.studentId === req.user.id
      );
    }

    // Apply search filters
    const searchTerm = query.toLowerCase();
    searchFiles = searchFiles.filter(file => 
      file.originalName.toLowerCase().includes(searchTerm)
    );

    // Filter by file type if specified
    if (type && type !== 'all') {
      searchFiles = searchFiles.filter(file => {
        const ext = path.extname(file.originalName).toLowerCase();
        return ext.includes(type.toLowerCase());
      });
    }

    // Filter by task if specified
    if (taskId) {
      searchFiles = searchFiles.filter(file => file.taskId === taskId);
    }

    const results = searchFiles.map(file => ({
      id: file.id,
      name: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: file.uploadedAt,
      taskId: file.taskId,
      relevance: file.originalName.toLowerCase().indexOf(searchTerm)
    })).sort((a, b) => a.relevance - b.relevance); // Sort by relevance

    res.json({
      success: true,
      results,
      count: results.length,
      query: query
    });

  } catch (error) {
    console.error('❌ File search error:', error);
    res.status(500).json({
      success: false,
      message: 'File search failed'
    });
  }
});

// ✅ Bulk operations
router.post('/bulk-action', verifyToken, async (req, res) => {
  try {
    const { action, fileIds } = req.body;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files specified'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const fileId of fileIds) {
      const file = fileStore[fileId];
      
      if (!file || !file.isActive) {
        results.failed.push({ fileId, reason: 'File not found' });
        continue;
      }

      // Check permissions
      const hasPermission = (
        req.user.role === 'faculty' ||
        file.uploadedBy === req.user.id
      );

      if (!hasPermission) {
        results.failed.push({ fileId, reason: 'Access denied' });
        continue;
      }

      // Perform action
      switch (action) {
        case 'delete':
          fileStore[fileId].isActive = false;
          results.success.push({ fileId, action: 'deleted' });
          break;
        
        default:
          results.failed.push({ fileId, reason: 'Unknown action' });
      }
    }

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      results
    });

  } catch (error) {
    console.error('❌ Bulk action error:', error);
    res.status(500).json({
      success: false,
      message: 'Bulk action failed'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
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
    message: error.message || 'File operation failed'
  });
});

console.log('📎 File upload routes initialized');

module.exports = router;