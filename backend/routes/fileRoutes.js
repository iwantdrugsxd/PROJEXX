const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const sharp = require('sharp');
const verifyToken = require('../middleware/verifyToken');
const Task = require('../models/taskSchema');
const DriveFile = require('../models/DriveFile');
const Submission = require('../models/Submission');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Google Drive setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Temporary file storage for processing
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // Allow images and common document types
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|pdf|doc|docx|txt|rtf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// 🔥 MAIN UPLOAD ENDPOINT - REPLACES EXISTING TASK SUBMISSION
router.post('/upload/:taskId', verifyToken, upload.array('files', 10), async (req, res) => {
  const submissionId = uuidv4();
  
  console.log(`[${new Date().toISOString()}] [FILE_UPLOAD] Starting upload for task ${req.params.taskId}`);

  try {
    const { taskId } = req.params;
    const { comment, collaborators } = req.body;
    const files = req.files;

    // Validate user is student
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit files'
      });
    }

    // Validate task exists
    const task = await Task.findById(taskId).populate('teams');
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if student is assigned to task
    const studentTeams = task.teams.filter(team => 
      team.members.some(member => member.toString() === req.user.id)
    );

    if (studentTeams.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this task'
      });
    }

    // Check files uploaded
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Create Google Drive folder structure
    const folderId = await createSubmissionFolder(taskId, req.user.id, task.title);

    // Create or update submission record
    let submission = await Submission.findOne({
      student: req.user.id,
      task: taskId
    });

    if (!submission) {
      submission = new Submission({
        student: req.user.id,
        task: taskId,
        comment: comment || '',
        collaborators: collaborators ? JSON.parse(collaborators) : [],
        driveFolderId: folderId,
        status: 'submitted'
      });
    } else {
      submission.comment = comment || submission.comment;
      submission.collaborators = collaborators ? JSON.parse(collaborators) : submission.collaborators;
      submission.submittedAt = new Date();
    }

    await submission.save();

    // Process and upload files
    const uploadedFiles = [];
    const errors = [];

    for (const file of files) {
      try {
        console.log(`[FILE_UPLOAD] Processing file: ${file.originalname}`);

        // Process image if it's an image
        let processedPath = file.path;
        let metadata = {};

        if (file.mimetype.startsWith('image/')) {
          const result = await processImage(file.path, file.originalname);
          processedPath = result.filePath;
          metadata = result.metadata;
        }

        // Upload to Google Drive
        const driveResponse = await uploadToGoogleDrive(
          processedPath,
          file.originalname,
          file.mimetype,
          folderId
        );

        // Save file metadata to database
        const driveFile = new DriveFile({
          driveFileId: driveResponse.id,
          originalName: file.originalname,
          fileName: driveResponse.name,
          mimeType: file.mimetype,
          size: parseInt(driveResponse.size),
          webViewLink: driveResponse.webViewLink,
          webContentLink: driveResponse.webContentLink,
          thumbnailLink: driveResponse.thumbnailLink,
          uploadedBy: req.user.id,
          taskId: taskId,
          submissionId: submission._id,
          folderId: folderId,
          isImage: file.mimetype.startsWith('image/'),
          metadata: metadata,
          status: 'completed'
        });

        await driveFile.save();

        // Add to submission
        submission.files.push(driveFile._id);

        uploadedFiles.push({
          id: driveFile._id,
          driveFileId: driveResponse.id,
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          viewLink: driveResponse.webViewLink,
          downloadLink: driveResponse.webContentLink,
          thumbnailLink: driveResponse.thumbnailLink,
          isImage: file.mimetype.startsWith('image/')
        });

        // Clean up temporary files
        fs.unlinkSync(file.path);
        if (processedPath !== file.path) {
          fs.unlinkSync(processedPath);
        }

        console.log(`[FILE_UPLOAD] Successfully uploaded: ${file.originalname}`);

      } catch (error) {
        console.error(`[FILE_UPLOAD] Error uploading ${file.originalname}:`, error);
        errors.push({
          filename: file.originalname,
          error: error.message
        });

        // Clean up on error
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    // Update submission
    await submission.save();

    // Update task with submission (if not already exists)
    const existingSubmission = task.submissions?.find(s => 
      s.student.toString() === req.user.id
    );

    if (!existingSubmission) {
      if (!task.submissions) task.submissions = [];
      task.submissions.push({
        id: submissionId,
        student: req.user.id,
        comment: comment || '',
        files: uploadedFiles.map(f => ({
          filename: f.name,
          originalName: f.name,
          path: f.viewLink,
          size: f.size,
          mimetype: f.type
        })),
        collaborators: collaborators ? JSON.parse(collaborators) : [],
        submittedAt: new Date(),
        status: 'submitted',
        attempt: 1,
        isLate: new Date() > new Date(task.dueDate)
      });
      
      await task.save();
    }

    console.log(`[FILE_UPLOAD] Upload completed for task ${taskId}`);

    res.json({
      success: true,
      message: 'Files uploaded successfully to Google Drive',
      submission: {
        id: submission._id,
        folderId: folderId,
        files: uploadedFiles,
        submittedAt: submission.submittedAt,
        comment: submission.comment
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[FILE_UPLOAD] Upload error:', error);

    // Clean up any temporary files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
});

// Get submission files for faculty dashboard
router.get('/submission/:submissionId', verifyToken, async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId)
      .populate('files')
      .populate('student', 'firstName lastName email')
      .populate('task', 'title');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check permissions
    const isOwner = submission.student._id.toString() === req.user.id;
    const isFaculty = req.user.role === 'faculty';

    if (!isOwner && !isFaculty) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      submission: {
        id: submission._id,
        student: submission.student,
        task: submission.task,
        comment: submission.comment,
        collaborators: submission.collaborators,
        submittedAt: submission.submittedAt,
        status: submission.status,
        folderId: submission.driveFolderId,
        files: submission.files.map(file => ({
          id: file._id,
          driveFileId: file.driveFileId,
          name: file.originalName,
          size: file.size,
          type: file.mimeType,
          viewLink: file.webViewLink,
          downloadLink: file.webContentLink,
          thumbnailLink: file.thumbnailLink,
          isImage: file.isImage,
          uploadedAt: file.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get submission',
      error: error.message
    });
  }
});

// Get all submissions for a task (faculty only)
router.get('/task/:taskId/submissions', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Faculty only.'
      });
    }

    const { taskId } = req.params;

    const submissions = await Submission.find({ task: taskId })
      .populate('student', 'firstName lastName email')
      .populate('files')
      .sort({ submittedAt: -1 });

    const formattedSubmissions = submissions.map(submission => ({
      id: submission._id,
      student: {
        id: submission.student._id,
        name: `${submission.student.firstName} ${submission.student.lastName}`,
        email: submission.student.email
      },
      comment: submission.comment,
      collaborators: submission.collaborators,
      submittedAt: submission.submittedAt,
      status: submission.status,
      driveFolderId: submission.driveFolderId,
      isLate: submission.isLate,
      files: submission.files.map(file => ({
        id: file._id,
        driveFileId: file.driveFileId,
        originalName: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        thumbnailLink: file.thumbnailLink,
        isImage: file.isImage
      }))
    }));

    res.json({
      success: true,
      submissions: formattedSubmissions
    });

  } catch (error) {
    console.error('Error fetching task submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message
    });
  }
});

// Helper Functions
async function createSubmissionFolder(taskId, studentId, taskTitle) {
  try {
    const baseFolderId = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID;
    
    // Create task folder
    const taskFolderName = `${taskTitle}_${taskId}`;
    const taskFolder = await findOrCreateFolder(taskFolderName, baseFolderId);
    
    // Create student folder
    const studentFolderName = `Student_${studentId}`;
    const studentFolder = await findOrCreateFolder(studentFolderName, taskFolder.id);
    
    return studentFolder.id;
  } catch (error) {
    throw new Error(`Failed to create submission folder: ${error.message}`);
  }
}

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

async function uploadToGoogleDrive(filePath, fileName, mimeType, folderId) {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, size, webViewLink, webContentLink, thumbnailLink, mimeType'
    });

    return response.data;
  } catch (error) {
    throw new Error(`Failed to upload to Google Drive: ${error.message}`);
  }
}

async function processImage(filePath, fileName) {
  try {
    const processedFileName = `processed_${fileName}`;
    const processedPath = path.join(path.dirname(filePath), processedFileName);

    const image = sharp(filePath);
    const metadata = await image.metadata();

    // Resize and compress
    await image
      .resize(1920, 1080, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85,
        progressive: true 
      })
      .toFile(processedPath);

    const stats = fs.statSync(processedPath);

    return {
      filePath: processedPath,
      metadata: {
        originalWidth: metadata.width,
        originalHeight: metadata.height,
        format: metadata.format,
        compressedSize: stats.size,
        isImage: true
      }
    };
  } catch (error) {
    // If processing fails, return original file
    return {
      filePath: filePath,
      metadata: { isImage: true }
    };
  }
}

module.exports = router;