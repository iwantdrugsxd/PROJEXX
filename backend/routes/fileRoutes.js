// backend/routes/fileRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { google } = require('googleapis');
const sharp = require('sharp');
const verifyToken = require('../middleware/verifyToken');
const Task = require('../models/taskSchema');
const DriveFile = require('../models/DriveFile');
const Submission = require('../models/Submission');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const router = express.Router();

// ✅ Security middleware
router.use(helmet());

// ✅ Rate limiting for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 uploads per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many upload attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ Google Drive setup with error handling
let drive = null;
let oauth2Client = null;

const initializeGoogleDrive = () => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      console.warn('⚠️  Google Drive credentials not found. File upload will use local storage.');
      return false;
    }

    oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    drive = google.drive({ version: 'v3', auth: oauth2Client });
    console.log('✅ Google Drive initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Google Drive:', error);
    return false;
  }
};

const isDriveEnabled = initializeGoogleDrive();

// ✅ Enhanced multer configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const tempDir = path.join(__dirname, '../temp');
      await fs.mkdir(tempDir, { recursive: true });
      cb(null, tempDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const extension = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `${timestamp}_${randomId}_${safeName}`;
    cb(null, uniqueName);
  }
});

// ✅ Comprehensive file filter
const fileFilter = (req, file, cb) => {
  try {
    console.log(`[FILE_FILTER] Processing: ${file.originalname}, MIME: ${file.mimetype}`);
    
    // Get allowed types from task or use defaults
    const allowedExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'mp3', 'zip', 'rar'];
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      'video/mp4',
      'audio/mpeg',
      'application/zip',
      'application/x-rar-compressed'
    ];

    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase().slice(1);
    const extensionValid = allowedExtensions.includes(extension);
    
    // Check MIME type
    const mimeValid = allowedMimeTypes.includes(file.mimetype);
    
    // Validate file name
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(file.originalname)) {
      return cb(new Error('File name contains invalid characters'), false);
    }
    
    if (file.originalname.length > 255) {
      return cb(new Error('File name is too long (max 255 characters)'), false);
    }
    
    if (extensionValid && mimeValid) {
      console.log(`[FILE_FILTER] ✅ File accepted: ${file.originalname}`);
      cb(null, true);
    } else {
      console.log(`[FILE_FILTER] ❌ File rejected: ${file.originalname} - Extension: ${extensionValid}, MIME: ${mimeValid}`);
      cb(new Error(`File type not allowed. Extension: .${extension}, MIME: ${file.mimetype}`), false);
    }
  } catch (error) {
    console.error('[FILE_FILTER] Error:', error);
    cb(error, false);
  }
};

// ✅ Enhanced multer setup
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
    fieldSize: 2 * 1024 * 1024, // 2MB for form fields
    fieldNameSize: 100,
    fields: 20
  }
});

// ✅ Image processing function
const processImage = async (filePath, originalName) => {
  try {
    const extension = path.extname(originalName).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(extension);
    
    if (!isImage) {
      return { filePath, metadata: {} };
    }

    console.log(`[IMAGE_PROCESSING] Processing image: ${originalName}`);
    
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    // Optimize image if it's too large
    if (metadata.width > 1920 || metadata.height > 1080 || fsSync.statSync(filePath).size > 5 * 1024 * 1024) {
      const optimizedPath = filePath.replace(/(\.[^.]+)$/, '_optimized$1');
      
      await image
        .resize(1920, 1080, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ 
          quality: 85, 
          progressive: true 
        })
        .toFile(optimizedPath);
      
      const optimizedStats = await fs.stat(optimizedPath);
      
      console.log(`[IMAGE_PROCESSING] ✅ Image optimized: ${originalName} - Size reduced from ${metadata.size} to ${optimizedStats.size}`);
      
      return {
        filePath: optimizedPath,
        metadata: {
          originalWidth: metadata.width,
          originalHeight: metadata.height,
          originalSize: metadata.size,
          optimizedSize: optimizedStats.size,
          format: metadata.format
        }
      };
    }
    
    return {
      filePath,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        size: metadata.size,
        format: metadata.format
      }
    };
  } catch (error) {
    console.error(`[IMAGE_PROCESSING] Error processing ${originalName}:`, error);
    return { filePath, metadata: {} };
  }
};

// ✅ Google Drive helper functions
const createSubmissionFolder = async (taskId, studentId, taskTitle) => {
  if (!isDriveEnabled) {
    throw new Error('Google Drive is not configured');
  }
  
  try {
    const baseFolderId = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID || 'root';
    
    // Create task folder
    const taskFolderName = `${taskTitle.replace(/[<>:"/\\|?*]/g, '_')}_${taskId}`;
    const taskFolder = await findOrCreateFolder(taskFolderName, baseFolderId);
    
    // Create student folder
    const studentFolderName = `Student_${studentId}`;
    const studentFolder = await findOrCreateFolder(studentFolderName, taskFolder.id);
    
    console.log(`[DRIVE_FOLDER] ✅ Created submission folder: ${studentFolderName} in ${taskFolderName}`);
    return studentFolder.id;
  } catch (error) {
    console.error('[DRIVE_FOLDER] Error creating submission folder:', error);
    throw error;
  }
};

const findOrCreateFolder = async (name, parentId) => {
  try {
    // Search for existing folder
    const searchResponse = await drive.files.list({
      q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0];
    }

    // Create new folder
    const folderMetadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };

    const createResponse = await drive.files.create({
      resource: folderMetadata,
      fields: 'id, name'
    });

    return createResponse.data;
  } catch (error) {
    console.error(`[DRIVE_FOLDER] Error finding/creating folder ${name}:`, error);
    throw error;
  }
};

const uploadToGoogleDrive = async (filePath, fileName, mimeType, folderId) => {
  if (!isDriveEnabled) {
    throw new Error('Google Drive is not configured');
  }
  
  try {
    console.log(`[DRIVE_UPLOAD] Uploading ${fileName} to folder ${folderId}`);
    
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: mimeType,
      body: fsSync.createReadStream(filePath)
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, size, webViewLink, webContentLink, thumbnailLink, mimeType'
    });

    console.log(`[DRIVE_UPLOAD] ✅ Uploaded ${fileName} with ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`[DRIVE_UPLOAD] Error uploading ${fileName}:`, error);
    throw error;
  }
};

// ✅ SINGLE FILE UPLOAD ENDPOINT (for progressive uploads)
router.post('/upload-single', uploadLimiter, verifyToken, upload.single('files'), async (req, res) => {
  const uploadId = uuidv4();
  console.log(`[${uploadId}] Single file upload started`);

  try {
    const { taskId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
    }

    // Validate user permissions
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can upload files'
      });
    }

    // Validate task exists and user has access
    const task = await Task.findById(taskId).populate('teams');
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if student is assigned to task
    const isAssigned = task.teams.some(team => 
      team.members.some(member => member.toString() === req.user.id)
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this task'
      });
    }

    console.log(`[${uploadId}] Processing file: ${file.originalname}`);

    // Process image if needed
    const processResult = await processImage(file.path, file.originalname);
    
    // Upload to Google Drive or store locally
    let driveResponse = null;
    let localPath = null;
    
    if (isDriveEnabled) {
      // Get or create submission folder
      const folderId = await createSubmissionFolder(taskId, req.user.id, task.title);
      driveResponse = await uploadToGoogleDrive(
        processResult.filePath,
        file.originalname,
        file.mimetype,
        folderId
      );
    } else {
      // Store locally (fallback)
      const uploadDir = path.join(__dirname, '../uploads', taskId, req.user.id);
      await fs.mkdir(uploadDir, { recursive: true });
      localPath = path.join(uploadDir, file.filename);
      await fs.copyFile(processResult.filePath, localPath);
    }

    // Clean up temporary files
    try {
      await fs.unlink(file.path);
      if (processResult.filePath !== file.path) {
        await fs.unlink(processResult.filePath);
      }
    } catch (cleanupError) {
      console.warn(`[${uploadId}] Cleanup warning:`, cleanupError.message);
    }

    const responseData = {
      success: true,
      file: {
        id: uploadId,
        originalName: file.originalname,
        fileName: file.filename,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
        metadata: processResult.metadata,
        ...(driveResponse && {
          driveFileId: driveResponse.id,
          webViewLink: driveResponse.webViewLink,
          webContentLink: driveResponse.webContentLink,
          thumbnailLink: driveResponse.thumbnailLink
        }),
        ...(localPath && {
          localPath: localPath
        })
      }
    };

    console.log(`[${uploadId}] ✅ Single file upload completed`);
    res.json(responseData);

  } catch (error) {
    console.error(`[${uploadId}] Single file upload error:`, error);

    // Clean up on error
    if (req.file?.path && fsSync.existsSync(req.file.path)) {
      try {
        fsSync.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError);
      }
    }

    // Send appropriate error response
    if (error.message.includes('File type not allowed')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Google Drive')) {
      return res.status(503).json({
        success: false,
        message: 'File storage service temporarily unavailable',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ MAIN SUBMISSION ENDPOINT
router.post('/upload/:taskId', uploadLimiter, verifyToken, async (req, res) => {
  const submissionId = uuidv4();
  console.log(`[${submissionId}] Task submission started for task ${req.params.taskId}`);

  try {
    const { taskId } = req.params;
    const { comment, collaborators, files } = req.body;

    // Validate required fields
    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Comment must be at least 10 characters long'
      });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one file is required'
      });
    }

    // Validate user permissions
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit assignments'
      });
    }

    // Validate task
    const task = await Task.findById(taskId).populate('teams');
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check assignment
    const isAssigned = task.teams.some(team => 
      team.members.some(member => member.toString() === req.user.id)
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this task'
      });
    }

    // Check if submissions are still allowed
    if (task.dueDate && new Date() > new Date(task.dueDate) && !task.allowLateSubmissions) {
      return res.status(400).json({
        success: false,
        message: 'Submission deadline has passed'
      });
    }

    console.log(`[${submissionId}] Creating submission record`);

    // Create or update submission
    let submission = await Submission.findOne({
      student: req.user.id,
      task: taskId
    });

    const isResubmission = !!submission;

    if (!submission) {
      submission = new Submission({
        student: req.user.id,
        task: taskId,
        comment: comment.trim(),
        collaborators: Array.isArray(collaborators) ? collaborators : [],
        status: 'submitted',
        attemptNumber: 1,
        isLate: task.dueDate ? new Date() > new Date(task.dueDate) : false
      });
    } else {
      submission.comment = comment.trim();
      submission.collaborators = Array.isArray(collaborators) ? collaborators : submission.collaborators;
      submission.submittedAt = new Date();
      submission.attemptNumber = (submission.attemptNumber || 1) + 1;
      submission.isLate = task.dueDate ? new Date() > new Date(task.dueDate) : false;
      submission.files = []; // Reset files for resubmission
    }

    await submission.save();

    // Process uploaded files
    const processedFiles = [];
    const errors = [];

    for (const fileData of files) {
      try {
        if (!fileData.id || !fileData.originalName) {
          errors.push({
            filename: fileData.originalName || 'Unknown',
            error: 'Invalid file data'
          });
          continue;
        }

        // Create DriveFile record
        const driveFile = new DriveFile({
          driveFileId: fileData.driveFileId || `local_${fileData.id}`,
          originalName: fileData.originalName,
          fileName: fileData.fileName || fileData.originalName,
          mimeType: fileData.mimeType || 'application/octet-stream',
          size: fileData.size || 0,
          webViewLink: fileData.webViewLink || null,
          webContentLink: fileData.webContentLink || null,
          thumbnailLink: fileData.thumbnailLink || null,
          uploadedBy: req.user.id,
          taskId: taskId,
          submissionId: submission._id,
          folderId: fileData.folderId || null,
          isImage: fileData.mimeType ? fileData.mimeType.startsWith('image/') : false,
          metadata: fileData.metadata || {},
          status: 'completed',
          localPath: fileData.localPath || null
        });

        await driveFile.save();
        submission.files.push(driveFile._id);

        processedFiles.push({
          id: driveFile._id,
          driveFileId: driveFile.driveFileId,
          originalName: fileData.originalName,
          size: fileData.size,
          mimeType: fileData.mimeType,
          webViewLink: fileData.webViewLink,
          webContentLink: fileData.webContentLink,
          thumbnailLink: fileData.thumbnailLink,
          isImage: driveFile.isImage,
          uploadedAt: driveFile.createdAt
        });

        console.log(`[${submissionId}] ✅ Processed file: ${fileData.originalName}`);

      } catch (error) {
        console.error(`[${submissionId}] Error processing file ${fileData.originalName}:`, error);
        errors.push({
          filename: fileData.originalName || 'Unknown',
          error: error.message
        });
      }
    }

    // Update submission with files
    await submission.save();

    // Update task submissions array
    const existingSubmissionIndex = task.submissions.findIndex(s => 
      s.student.toString() === req.user.id
    );

    const submissionData = {
      id: submission._id,
      student: req.user.id,
      comment: submission.comment,
      files: processedFiles.map(f => ({
        filename: f.originalName,
        originalName: f.originalName,
        path: f.webViewLink || f.localPath,
        size: f.size,
        mimetype: f.mimeType
      })),
      collaborators: submission.collaborators,
      submittedAt: submission.submittedAt,
      status: submission.status,
      attemptNumber: submission.attemptNumber,
      isLate: submission.isLate
    };

    if (existingSubmissionIndex >= 0) {
      task.submissions[existingSubmissionIndex] = submissionData;
    } else {
      task.submissions.push(submissionData);
    }

    await task.save();

    console.log(`[${submissionId}] ✅ Submission completed - Files: ${processedFiles.length}, Errors: ${errors.length}`);

    // Send response
    const response = {
      success: true,
      message: isResubmission ? 'Assignment resubmitted successfully' : 'Assignment submitted successfully',
      submission: {
        id: submission._id,
        submittedAt: submission.submittedAt,
        attemptNumber: submission.attemptNumber,
        isLate: submission.isLate,
        isResubmission,
        comment: submission.comment,
        collaborators: submission.collaborators,
        files: processedFiles
      }
    };

    if (errors.length > 0) {
      response.warnings = errors;
      response.message += ` (${errors.length} file(s) had issues)`;
    }

    res.json(response);

  } catch (error) {
    console.error(`[${submissionId}] Submission error:`, error);

    // Determine appropriate error response
    let statusCode = 500;
    let message = 'Submission failed';

    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
    } else if (error.message.includes('not found')) {
      statusCode = 404;
      message = error.message;
    } else if (error.message.includes('not assigned') || error.message.includes('Access denied')) {
      statusCode = 403;
      message = error.message;
    } else if (error.message.includes('deadline')) {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      submissionId
    });
  }
});

// ✅ GET SUBMISSION FILES (Faculty Dashboard)
router.get('/submission/:submissionId', verifyToken, async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId)
      .populate('files')
      .populate('student', 'firstName lastName email studentId')
      .populate('task', 'title maxPoints dueDate');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check permissions
    const isOwner = submission.student._id.toString() === req.user.id;
    const isFaculty = req.user.role === 'faculty';
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isFaculty && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Format response
    const response = {
      success: true,
      submission: {
        id: submission._id,
        student: {
          id: submission.student._id,
          name: `${submission.student.firstName} ${submission.student.lastName}`,
          email: submission.student.email,
          studentId: submission.student.studentId
        },
        task: {
          id: submission.task._id,
          title: submission.task.title,
          maxPoints: submission.task.maxPoints,
          dueDate: submission.task.dueDate
        },
        comment: submission.comment,
        collaborators: submission.collaborators,
        submittedAt: submission.submittedAt,
        status: submission.status,
        attemptNumber: submission.attemptNumber,
        isLate: submission.isLate,
        grade: submission.grade,
        feedback: submission.feedback,
        gradedAt: submission.gradedAt,
        gradedBy: submission.gradedBy,
        files: submission.files.map(file => ({
          id: file._id,
          driveFileId: file.driveFileId,
          originalName: file.originalName,
          fileName: file.fileName,
          size: file.size,
          mimeType: file.mimeType,
          webViewLink: file.webViewLink,
          webContentLink: file.webContentLink,
          thumbnailLink: file.thumbnailLink,
          isImage: file.isImage,
          metadata: file.metadata,
          uploadedAt: file.createdAt,
          status: file.status
        }))
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ GET ALL SUBMISSIONS FOR A TASK (Faculty Dashboard)
router.get('/task/:taskId/submissions', verifyToken, async (req, res) => {
  try {
    // Only faculty and admins can view all submissions
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Faculty or admin access required.'
      });
    }

    const { taskId } = req.params;
    const { page = 1, limit = 20, status, sortBy = 'submittedAt', sortOrder = 'desc' } = req.query;

    // Build query
    const query = { task: taskId };
    if (status) {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [submissions, total] = await Promise.all([
      Submission.find(query)
        .populate('student', 'firstName lastName email studentId')
        .populate('files', 'originalName size mimeType webViewLink isImage status')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Submission.countDocuments(query)
    ]);

    // Format submissions
    const formattedSubmissions = submissions.map(submission => ({
      id: submission._id,
      student: {
        id: submission.student._id,
        name: `${submission.student.firstName} ${submission.student.lastName}`,
        email: submission.student.email,
        studentId: submission.student.studentId
      },
      comment: submission.comment,
      collaborators: submission.collaborators,
      submittedAt: submission.submittedAt,
      status: submission.status,
      attemptNumber: submission.attemptNumber,
      isLate: submission.isLate,
      grade: submission.grade,
      feedback: submission.feedback,
      gradedAt: submission.gradedAt,
      fileCount: submission.files.length,
      files: submission.files.map(file => ({
        id: file._id,
        originalName: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        isImage: file.isImage,
        status: file.status
      }))
    }));

    res.json({
      success: true,
      submissions: formattedSubmissions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      },
      filters: {
        status,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('Error fetching task submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ DOWNLOAD FILE ENDPOINT
router.get('/download/:fileId', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await DriveFile.findById(fileId)
      .populate('submissionId')
      .populate({
        path: 'submissionId',
        populate: { path: 'student', select: 'firstName lastName email' }
      });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permissions
    const isOwner = file.uploadedBy.toString() === req.user.id;
    const isFaculty = req.user.role === 'faculty';
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isFaculty && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // If file is on Google Drive, redirect to download URL
    if (file.webContentLink) {
      return res.redirect(file.webContentLink);
    }

    // If file is stored locally, serve it
    if (file.localPath && fsSync.existsSync(file.localPath)) {
      return res.download(file.localPath, file.originalName);
    }

    // File not found in any storage
    res.status(404).json({
      success: false,
      message: 'File content not available'
    });

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Download failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ DELETE FILE ENDPOINT
router.delete('/file/:fileId', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await DriveFile.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permissions - only file owner or admin can delete
    const isOwner = file.uploadedBy.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete from Google Drive if exists
    if (isDriveEnabled && file.driveFileId && !file.driveFileId.startsWith('local_')) {
      try {
        await drive.files.delete({ fileId: file.driveFileId });
        console.log(`✅ Deleted file from Google Drive: ${file.driveFileId}`);
      } catch (driveError) {
        console.warn(`Warning: Could not delete from Google Drive: ${driveError.message}`);
      }
    }

    // Delete local file if exists
    if (file.localPath && fsSync.existsSync(file.localPath)) {
      try {
        await fs.unlink(file.localPath);
        console.log(`✅ Deleted local file: ${file.localPath}`);
      } catch (localError) {
        console.warn(`Warning: Could not delete local file: ${localError.message}`);
      }
    }

    // Remove from submission
    if (file.submissionId) {
      await Submission.findByIdAndUpdate(
        file.submissionId,
        { $pull: { files: file._id } }
      );
    }

    // Delete database record
    await DriveFile.findByIdAndDelete(fileId);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ HEALTH CHECK ENDPOINT
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'File Upload Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      googleDrive: isDriveEnabled,
      localStorage: true,
      imageProcessing: true
    }
  });
});

// ✅ Error handling middleware
router.use((error, req, res, next) => {
  console.error('File routes error:', error);

  // Multer errors
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 50MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 10 files allowed.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }

  // File filter errors
  if (error.message.includes('File type not allowed') || error.message.includes('invalid characters')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;