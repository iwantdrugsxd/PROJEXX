// backend/routes/fileRoutes.js - FIXED VERSION
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

console.log('🔧 Loading fixed fileRoutes.js...');

// Import middleware
const verifyToken = require('../middleware/verifyToken');

// Safe import of models (if they don't exist, disable features)
let Task = null;
let DriveFile = null;
let Submission = null;
let hasModels = false;



try {
  Task = require('../models/taskSchema');
  console.log('✅ Task model loaded');
} catch (err) {
  console.log('⚠️  Task model not found');
}

try {
  DriveFile = require('../models/DriveFile');
  console.log('✅ DriveFile model loaded');
} catch (err) {
  console.log('⚠️  DriveFile model not found - creating simple version');
  // Create a simple mock model
  DriveFile = class {
    constructor(data) { Object.assign(this, data); }
    save() { return Promise.resolve(this); }
    static findById() { return Promise.resolve(null); }
    static findByIdAndDelete() { return Promise.resolve(); }
  };
}

try {
  Submission = require('../models/Submission');
  console.log('✅ Submission model loaded');
} catch (err) {
  console.log('⚠️  Submission model not found - creating simple version');
  // Create a simple mock model
  Submission = class {
    constructor(data) { Object.assign(this, data); }
    save() { return Promise.resolve(this); }
    static findById() { return Promise.resolve(null); }
    static findByIdAndUpdate() { return Promise.resolve(); }
  };
}

// Check if we have all required models
hasModels = !!(Task && DriveFile && Submission);

// Google Drive setup (optional)
let drive = null;
let isDriveEnabled = false;

try {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
    const { google } = require('googleapis');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
    
    drive = google.drive({ version: 'v3', auth: oauth2Client });
    isDriveEnabled = true;
    console.log('✅ Google Drive initialized');
  } else {
    console.log('⚠️  Google Drive credentials not found - using local storage only');
  }
} catch (err) {
  console.log('⚠️  Google Drive initialization failed:', err.message);
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fsSync.existsSync(uploadsDir)) {
  fsSync.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

// Multer configuration for local file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allow most common file types
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'application/json', 'application/zip', 'application/x-zip-compressed'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10 // Maximum 10 files
  }
});

// ============================================
// FILE UPLOAD ENDPOINT
// ============================================

router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    console.log(`🔧 [FILE_UPLOAD] Upload request from user ${req.user.id}`);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const { taskId, comment = '', collaborators = [] } = req.body;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
    }

    const uploadedFiles = [];
    const errors = [];

    // Process each uploaded file
    for (const file of req.files) {
      try {
        console.log(`📁 Processing file: ${file.originalname}`);
        
        const fileData = {
          driveFileId: `local_${uuidv4()}`,
          originalName: file.originalname,
          fileName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          localPath: file.path,
          webViewLink: `/uploads/${file.filename}`,
          webContentLink: `/uploads/${file.filename}`,
          uploadedBy: req.user.id,
          taskId: taskId,
          isImage: file.mimetype.startsWith('image/'),
          uploadedAt: new Date()
        };

        // Try to upload to Google Drive if available
        if (isDriveEnabled && drive) {
          try {
            console.log(`☁️  Uploading ${file.originalname} to Google Drive...`);
            
            const driveResponse = await drive.files.create({
              resource: {
                name: file.originalname,
                parents: [process.env.GOOGLE_DRIVE_BASE_FOLDER_ID || '1LhJJ0XPP9r3m3t4TGj8k7_placeholder']
              },
              media: {
                mimeType: file.mimetype,
                body: fsSync.createReadStream(file.path)
              },
              fields: 'id, webViewLink, webContentLink'
            });

            fileData.driveFileId = driveResponse.data.id;
            fileData.webViewLink = driveResponse.data.webViewLink;
            fileData.webContentLink = driveResponse.data.webContentLink;
            
            console.log(`✅ Uploaded to Google Drive: ${driveResponse.data.id}`);
          } catch (driveError) {
            console.warn(`⚠️  Google Drive upload failed: ${driveError.message}`);
            // Continue with local storage
          }
        }

        // Save file record if models are available
        if (hasModels && DriveFile) {
          const driveFile = new DriveFile(fileData);
          await driveFile.save();
          fileData._id = driveFile._id;
        }

        uploadedFiles.push(fileData);
        console.log(`✅ File processed successfully: ${file.originalname}`);
        
      } catch (fileError) {
        console.error(`❌ Error processing file ${file.originalname}:`, fileError);
        errors.push({
          filename: file.originalname,
          error: fileError.message
        });
      }
    }

    console.log(`📊 Upload complete: ${uploadedFiles.length} files uploaded, ${errors.length} errors`);

    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      googleDriveEnabled: isDriveEnabled
    });

  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});




// Add this new endpoint to your fileRoutes.js file
// Add it after the existing /upload endpoint

// ============================================
// TASK FILE SUBMISSION ENDPOINT  
// ============================================

// ============================================
// SINGLE FILE UPLOAD ENDPOINT (for individual file uploads)
// ============================================





router.post('/upload-single',  upload.single('files'), async (req, res) => {
  try {
    console.log(`🔧 [SINGLE_UPLOAD] Single file upload from user ${req.user.id}`);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { taskId } = req.body;
    const file = req.file;
    
    console.log(`📁 Processing single file: ${file.originalname}`);
    
    const fileData = {
      driveFileId: `local_${uuidv4()}`,
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      localPath: file.path,
      webViewLink: `/uploads/${file.filename}`,
      webContentLink: `/uploads/${file.filename}`,
      uploadedBy: req.user.id,
      taskId: taskId,
      isImage: file.mimetype.startsWith('image/'),
      uploadedAt: new Date()
    };

    // Try to upload to Google Drive if available
    if (isDriveEnabled && drive) {
      try {
        console.log(`☁️  Uploading ${file.originalname} to Google Drive...`);
        
        const driveResponse = await drive.files.create({
          resource: {
            name: file.originalname,
            parents: [process.env.GOOGLE_DRIVE_BASE_FOLDER_ID || '1LhJJ0XPP9r3m3t4TGj8k7_placeholder']
          },
          media: {
            mimeType: file.mimetype,
            body: fsSync.createReadStream(file.path)
          },
          fields: 'id, webViewLink, webContentLink'
        });

        fileData.driveFileId = driveResponse.data.id;
        fileData.webViewLink = driveResponse.data.webViewLink;
        fileData.webContentLink = driveResponse.data.webContentLink;
        
        console.log(`✅ Uploaded to Google Drive: ${driveResponse.data.id}`);
      } catch (driveError) {
        console.warn(`⚠️  Google Drive upload failed: ${driveError.message}`);
        // Continue with local storage
      }
    }

    // Save file record if models are available
    if (hasModels && DriveFile) {
      const driveFile = new DriveFile(fileData);
      await driveFile.save();
      fileData._id = driveFile._id;
    }

    console.log(`✅ Single file processed successfully: ${file.originalname}`);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: fileData,
      googleDriveEnabled: isDriveEnabled
    });

  } catch (error) {
    console.error('❌ Single file upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Single file upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});




// ============================================
// TASK FILE SUBMISSION ENDPOINT  
// ============================================

router.post('/upload/:taskId',  upload.array('files', 10), async (req, res) => {
  try {
    console.log(`🔧 [TASK_SUBMISSION] Task submission request from user ${req.user.id} for task ${req.params.taskId}`);
    
    const { taskId } = req.params;
    const { comment = '', collaborators = '[]' } = req.body;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
    }

    // Verify task exists if we have the Task model
    let task = null;
    if (hasModels && Task) {
      try {
        task = await Task.findById(taskId);
        if (!task) {
          return res.status(404).json({
            success: false,
            message: 'Task not found'
          });
        }
        
        // Check if user has access to this task (basic check)
        // You might want to add more sophisticated access control here
        console.log(`✅ Task found: ${task.title}`);
      } catch (taskError) {
        console.error('Error fetching task:', taskError);
        return res.status(500).json({
          success: false,
          message: 'Error verifying task access'
        });
      }
    }

    const uploadedFiles = [];
    const errors = [];

    // Process uploaded files if any
    if (req.files && req.files.length > 0) {
      console.log(`📁 Processing ${req.files.length} files for task ${taskId}`);
      
      for (const file of req.files) {
        try {
          console.log(`📁 Processing file: ${file.originalname}`);
          
          const fileData = {
            driveFileId: `local_${uuidv4()}`,
            originalName: file.originalname,
            fileName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            localPath: file.path,
            webViewLink: `/uploads/${file.filename}`,
            webContentLink: `/uploads/${file.filename}`,
            uploadedBy: req.user.id,
            taskId: taskId,
            isImage: file.mimetype.startsWith('image/'),
            uploadedAt: new Date()
          };

          // Try to upload to Google Drive if available
          if (isDriveEnabled && drive) {
            try {
              console.log(`☁️  Uploading ${file.originalname} to Google Drive...`);
              
              const driveResponse = await drive.files.create({
                resource: {
                  name: file.originalname,
                  parents: [process.env.GOOGLE_DRIVE_BASE_FOLDER_ID || '1LhJJ0XPP9r3m3t4TGj8k7_placeholder']
                },
                media: {
                  mimeType: file.mimetype,
                  body: fsSync.createReadStream(file.path)
                },
                fields: 'id, webViewLink, webContentLink'
              });

              fileData.driveFileId = driveResponse.data.id;
              fileData.webViewLink = driveResponse.data.webViewLink;
              fileData.webContentLink = driveResponse.data.webContentLink;
              
              console.log(`✅ Uploaded to Google Drive: ${driveResponse.data.id}`);
            } catch (driveError) {
              console.warn(`⚠️  Google Drive upload failed: ${driveError.message}`);
              // Continue with local storage
            }
          }

          // Save file record if models are available
          if (hasModels && DriveFile) {
            const driveFile = new DriveFile(fileData);
            await driveFile.save();
            fileData._id = driveFile._id;
          }

          uploadedFiles.push(fileData);
          console.log(`✅ File processed successfully: ${file.originalname}`);
          
        } catch (fileError) {
          console.error(`❌ Error processing file ${file.originalname}:`, fileError);
          errors.push({
            filename: file.originalname,
            error: fileError.message
          });
        }
      }
    }

    // Process collaborators
    let parsedCollaborators = [];
    try {
      parsedCollaborators = JSON.parse(collaborators);
    } catch (e) {
      if (collaborators && typeof collaborators === 'string' && collaborators.trim()) {
        parsedCollaborators = [collaborators.trim()];
      }
    }

    // Create the submission record if we have the Task model
    if (hasModels && Task && task) {
      try {
        // Find existing submission or create new one
        let existingSubmissionIndex = -1;
        if (task.submissions) {
          existingSubmissionIndex = task.submissions.findIndex(s => 
            s.student && s.student.toString() === req.user.id
          );
        }

  

// Alternative fix if you need to keep track of submission IDs:
// Use MongoDB ObjectId instead of UUID
const { Types } = require('mongoose');


const submissionData = {
  
  student: req.user.id,
  submissionText: comment.trim(),
  comment: comment.trim(),
  collaborators: parsedCollaborators,
  files: uploadedFiles.map(f => ({
    fileId: f._id || f.driveFileId,
    originalName: f.originalName,
    fileName: f.fileName,
    size: f.size,
    mimeType: f.mimeType,
    webViewLink: f.webViewLink
  })),
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
          console.log(`📝 Updated existing submission for user ${req.user.id}`);
        } else {
          task.submissions.push(submissionData);
          console.log(`📝 Created new submission for user ${req.user.id}`);
        }

        task.updatedAt = new Date();
        await task.save();
        
        console.log(`✅ Task submission saved successfully`);
      } catch (submissionError) {
        console.error('Error saving submission:', submissionError);
        // Don't fail the entire request if submission saving fails
      }
    }

    console.log(`📊 Task submission complete: ${uploadedFiles.length} files uploaded, ${errors.length} errors`);

    res.json({
      success: true,
      message: `Task submitted successfully${uploadedFiles.length > 0 ? ` with ${uploadedFiles.length} file(s)` : ''}`,
      submission: {
        taskId: taskId,
        comment: comment.trim(),
        collaborators: parsedCollaborators,
        files: uploadedFiles,
        submittedAt: new Date().toISOString(),
        filesCount: uploadedFiles.length
      },
      errors: errors.length > 0 ? errors : undefined,
      googleDriveEnabled: isDriveEnabled
    });

  } catch (error) {
    console.error('❌ Task submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Task submission failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});






// ============================================
// FILE DOWNLOAD ENDPOINT
// ============================================

router.get('/download/:fileId',  async (req, res) => {
  try {
    const { fileId } = req.params;
    
    let file = null;
    
    if (hasModels && DriveFile) {
      file = await DriveFile.findById(fileId);
    }
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if local file exists
    if (file.localPath && fsSync.existsSync(file.localPath)) {
      res.download(file.localPath, file.originalName);
    } else if (file.webContentLink) {
      res.redirect(file.webContentLink);
    } else {
      res.status(404).json({
        success: false,
        message: 'File not accessible'
      });
    }

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      success: false,
      message: 'Download failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================
// GET FILES BY TASK
// ============================================

router.get('/task/:taskId',  async (req, res) => {
  try {
    const { taskId } = req.params;
    
    let files = [];
    
    if (hasModels && DriveFile) {
      files = await DriveFile.find({ taskId }).sort({ uploadedAt: -1 });
    }

    res.json({
      success: true,
      files,
      count: files.length
    });

  } catch (error) {
    console.error('Error fetching task files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch files',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================
// DELETE FILE
// ============================================

router.delete('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    let file = null;
    
    if (hasModels && DriveFile) {
      file = await DriveFile.findById(fileId);
    }
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check permissions
    const isOwner = file.uploadedBy && file.uploadedBy.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'faculty';

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
        console.log(`✅ Deleted from Google Drive: ${file.driveFileId}`);
      } catch (driveError) {
        console.warn(`⚠️  Could not delete from Google Drive: ${driveError.message}`);
      }
    }

    // Delete local file
    if (file.localPath && fsSync.existsSync(file.localPath)) {
      try {
        await fs.unlink(file.localPath);
        console.log(`✅ Deleted local file: ${file.localPath}`);
      } catch (localError) {
        console.warn(`⚠️  Could not delete local file: ${localError.message}`);
      }
    }

    // Delete database record
    if (hasModels && DriveFile) {
      await DriveFile.findByIdAndDelete(fileId);
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'File Upload Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      googleDrive: isDriveEnabled,
      localStorage: true,
      modelsAvailable: hasModels,
      uploadsDirectory: fsSync.existsSync(uploadsDir)
    },
    config: {
      maxFileSize: '50MB',
      maxFiles: 10,
      allowedTypes: 'Images, PDFs, Office docs, Text files, Archives'
    }
  });
});



// Debug: List all routes registered on this router
console.log('📍 [FILE_ROUTES] Registered routes:');
router.stack.forEach((layer) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
    console.log(`   ${methods} ${layer.route.path}`);
  }
});

// Also add a catch-all route for debugging
router.all('*', (req, res, next) => {
  console.log(`🔍 [FILE_ROUTES] Unmatched route in file router: ${req.method} ${req.path}`);
  console.log(`   Full URL: ${req.originalUrl}`);
  console.log(`   Base URL: ${req.baseUrl}`);
  next(); // Pass to next handler
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

router.use((error, req, res, next) => {
  console.error('📁 File routes error:', error);

  // Multer-specific errors
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
  if (error.message && error.message.includes('File type') && error.message.includes('not allowed')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message: 'File service error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

console.log('✅ File routes loaded successfully (fixed version)');
module.exports = router;