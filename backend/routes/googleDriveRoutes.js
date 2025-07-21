// backend/routes/googleDriveRoutes.js - FIXED VERSION
const express = require('express');
const router = express.Router();

console.log('🔧 Loading fixed googleDriveRoutes.js...');

// Import middleware
const verifyToken = require('../middleware/verifyToken');

// Safe model imports
let DriveFile = null;
let Submission = null;

try {
  DriveFile = require('../models/DriveFile');
  console.log('✅ DriveFile model loaded');
} catch (err) {
  console.log('⚠️  DriveFile model not found - creating mock');
  DriveFile = class {
    constructor(data) { Object.assign(this, data); }
    save() { return Promise.resolve(this); }
    static find() { return Promise.resolve([]); }
  };
}

try {
  Submission = require('../models/Submission');
  console.log('✅ Submission model loaded');
} catch (err) {
  console.log('⚠️  Submission model not found - creating mock');
  Submission = class {
    static findByIdAndUpdate() { return Promise.resolve(); }
  };
}

// Google Drive setup
let drive = null;
let isDriveEnabled = false;

const initializeGoogleDrive = () => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      console.warn('⚠️  Google Drive credentials not configured');
      return false;
    }

    const { google } = require('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    drive = google.drive({ version: 'v3', auth: oauth2Client });
    isDriveEnabled = true;
    console.log('✅ Google Drive API initialized');
    return true;

  } catch (error) {
    console.error('❌ Google Drive initialization failed:', error.message);
    return false;
  }
};

// Initialize Google Drive
initializeGoogleDrive();

// ============================================
// HELPER FUNCTIONS
// ============================================

const findOrCreateFolder = async (name, parentId) => {
  if (!isDriveEnabled) {
    throw new Error('Google Drive not configured');
  }

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
    console.error(`Error finding/creating folder ${name}:`, error);
    throw error;
  }
};

// ============================================
// ROUTES
// ============================================

// Create submission folder
router.post('/create-submission-folder', verifyToken, async (req, res) => {
  try {
    if (!isDriveEnabled) {
      return res.status(503).json({
        success: false,
        message: 'Google Drive service not available',
        error: 'Google Drive credentials not configured'
      });
    }

    const { taskId, taskTitle } = req.body;
    const studentId = req.user.id;

    if (!taskId || !taskTitle) {
      return res.status(400).json({
        success: false,
        message: 'Task ID and title are required'
      });
    }

    const baseFolderId = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID || 'root';
    
    // Create or find task folder
    const taskFolderName = `${taskTitle.replace(/[<>:"/\\|?*]/g, '_')}_${taskId}`;
    const taskFolder = await findOrCreateFolder(taskFolderName, baseFolderId);
    
    // Create student folder
    const studentFolderName = `Student_${studentId}`;
    const studentFolder = await findOrCreateFolder(studentFolderName, taskFolder.id);

    console.log(`✅ Created submission folder: ${studentFolderName} in ${taskFolderName}`);

    res.json({
      success: true,
      folderId: studentFolder.id,
      folderName: studentFolderName,
      taskFolderId: taskFolder.id,
      folderUrl: `https://drive.google.com/drive/folders/${studentFolder.id}`
    });

  } catch (error) {
    console.error('Error creating submission folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create submission folder',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Share folder with faculty
router.post('/share-folder', verifyToken, async (req, res) => {
  try {
    if (!isDriveEnabled) {
      return res.status(503).json({
        success: false,
        message: 'Google Drive service not available'
      });
    }

    const { folderId, facultyEmails } = req.body;

    if (!folderId || !facultyEmails || !Array.isArray(facultyEmails)) {
      return res.status(400).json({
        success: false,
        message: 'Folder ID and faculty emails array are required'
      });
    }

    const results = [];

    for (const email of facultyEmails) {
      try {
        await drive.permissions.create({
          fileId: folderId,
          resource: {
            role: 'reader',
            type: 'user',
            emailAddress: email
          }
        });
        results.push({ email, status: 'success' });
      } catch (error) {
        console.error(`Failed to share with ${email}:`, error.message);
        results.push({ email, status: 'failed', error: error.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    res.json({
      success: successCount > 0,
      message: `Folder shared with ${successCount}/${facultyEmails.length} faculty members`,
      results
    });

  } catch (error) {
    console.error('Error sharing folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share folder',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get files from Google Drive folder
router.get('/folder/:folderId/files', verifyToken, async (req, res) => {
  try {
    if (!isDriveEnabled) {
      return res.status(503).json({
        success: false,
        message: 'Google Drive service not available'
      });
    }

    const { folderId } = req.params;

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime, modifiedTime)',
      orderBy: 'createdTime desc'
    });

    res.json({
      success: true,
      files: response.data.files,
      count: response.data.files.length
    });

  } catch (error) {
    console.error('Error fetching folder files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch folder files',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Upload file to Google Drive
router.post('/upload', verifyToken, async (req, res) => {
  try {
    if (!isDriveEnabled) {
      return res.status(503).json({
        success: false,
        message: 'Google Drive service not available'
      });
    }

    // This would typically be handled by multer middleware
    // For now, return a placeholder response
    res.json({
      success: false,
      message: 'Direct Google Drive upload not implemented',
      suggestion: 'Use /api/files/upload for file uploads with Google Drive integration'
    });

  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get Google Drive usage info
router.get('/usage', verifyToken, async (req, res) => {
  try {
    if (!isDriveEnabled) {
      return res.status(503).json({
        success: false,
        message: 'Google Drive service not available'
      });
    }

    const about = await drive.about.get({
      fields: 'storageQuota, user'
    });

    const quota = about.data.storageQuota;
    const usedGB = Math.round((quota.usage / (1024 * 1024 * 1024)) * 100) / 100;
    const limitGB = quota.limit ? Math.round((quota.limit / (1024 * 1024 * 1024)) * 100) / 100 : 'Unlimited';

    res.json({
      success: true,
      user: about.data.user,
      storage: {
        used: usedGB,
        limit: limitGB,
        usedBytes: parseInt(quota.usage),
        limitBytes: quota.limit ? parseInt(quota.limit) : null,
        usageInDrive: quota.usageInDrive ? Math.round((quota.usageInDrive / (1024 * 1024 * 1024)) * 100) / 100 : null
      }
    });

  } catch (error) {
    console.error('Error fetching Google Drive usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Google Drive Service',
    status: isDriveEnabled ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString(),
    features: {
      folderCreation: isDriveEnabled,
      fileSharing: isDriveEnabled,
      fileUpload: isDriveEnabled,
      quotaCheck: isDriveEnabled
    },
    config: {
      clientIdConfigured: !!process.env.GOOGLE_CLIENT_ID,
      clientSecretConfigured: !!process.env.GOOGLE_CLIENT_SECRET,
      refreshTokenConfigured: !!process.env.GOOGLE_REFRESH_TOKEN,
      baseFolderConfigured: !!process.env.GOOGLE_DRIVE_BASE_FOLDER_ID
    }
  });
});

// Handle all other routes
router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Google Drive route not found',
    availableRoutes: [
      'POST /create-submission-folder',
      'POST /share-folder',
      'GET /folder/:folderId/files',
      'POST /upload',
      'GET /usage',
      'GET /health'
    ]
  });
});

console.log('✅ Google Drive routes loaded successfully (fixed version)');
module.exports = router;