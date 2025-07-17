// backend/routes/fileRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

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