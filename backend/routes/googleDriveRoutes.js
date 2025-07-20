const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const verifyToken = require('../middleware/verifyToken');
const DriveFile = require('../models/DriveFile');
const Submission = require('../models/Submission');

// Google Drive configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Create folder structure for task submissions
router.post('/create-submission-folder', verifyToken, async (req, res) => {
  try {
    const { taskId, taskTitle } = req.body;
    const studentId = req.user.id;

    // Create folder structure: TaskSubmissions/TaskTitle_TaskID/Student_StudentID
    const baseFolderId = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID;
    
    // Create or find task folder
    const taskFolderName = `${taskTitle}_${taskId}`;
    let taskFolder = await findOrCreateFolder(taskFolderName, baseFolderId);
    
    // Create student folder
    const studentFolderName = `Student_${studentId}`;
    let studentFolder = await findOrCreateFolder(studentFolderName, taskFolder.id);

    res.json({
      success: true,
      folderId: studentFolder.id,
      folderName: studentFolderName,
      taskFolderId: taskFolder.id
    });

  } catch (error) {
    console.error('Error creating submission folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create submission folder',
      error: error.message
    });
  }
});

// Share folder with faculty
router.post('/share-folder', verifyToken, async (req, res) => {
  try {
    const { folderId, facultyEmails } = req.body;

    for (const email of facultyEmails) {
      await drive.permissions.create({
        fileId: folderId,
        resource: {
          role: 'reader',
          type: 'user',
          emailAddress: email
        }
      });
    }

    res.json({
      success: true,
      message: 'Folder shared with faculty'
    });

  } catch (error) {
    console.error('Error sharing folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share folder',
      error: error.message
    });
  }
});

// Get files from Google Drive folder
router.get('/folder/:folderId/files', verifyToken, async (req, res) => {
  try {
    const { folderId } = req.params;

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime)'
    });

    res.json({
      success: true,
      files: response.data.files
    });

  } catch (error) {
    console.error('Error fetching folder files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch folder files',
      error: error.message
    });
  }
});

// Helper function to find or create folder
async function findOrCreateFolder(name, parentId) {
  try {
    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });

    if (response.data.files.length > 0) {
      return response.data.files[0];
    }

    // Create new folder
    const folderMetadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id, name'
    });

    return folder.data;
  } catch (error) {
    throw new Error(`Failed to find or create folder: ${error.message}`);
  }
}

module.exports = router;