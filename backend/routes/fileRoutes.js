// ===== backend/routes/fileRoutes.js (COMPLETE FIXED FILE) =====
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const File = require("../models/fileSchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 fileRoutes.js loaded");

// ✅ FIXED: Enhanced directory creation
const createUploadDirectories = () => {
  const baseUploadsDir = path.join(__dirname, '../uploads');
  const directories = [
    baseUploadsDir,
    path.join(baseUploadsDir, 'faculty'),
    path.join(baseUploadsDir, 'student'),
    path.join(baseUploadsDir, 'profiles'),
    path.join(baseUploadsDir, 'general')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });

  return baseUploadsDir;
};

const uploadsDir = createUploadDirectories();

// ✅ FIXED: Enhanced multer configuration with filename sanitization
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userRole = req.user?.role || 'general';
    const uploadPath = path.join(uploadsDir, userRole);
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase();
      
      // ✅ CRITICAL FIX: Sanitize filename to prevent ENOENT errors
      let baseName = path.basename(file.originalname, path.extname(file.originalname));
      
      baseName = baseName
        .normalize('NFD') // Normalize unicode
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Replace spaces and special chars
        .replace(/_{2,}/g, '_') // Replace multiple underscores
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .substring(0, 50) // Limit length
        .toLowerCase(); // Convert to lowercase
      
      if (!baseName || baseName.length === 0) {
        baseName = 'file';
      }
      
      const safeFilename = `${baseName}_${uniqueSuffix}${ext}`;
      
      console.log(`📁 General file upload - Original: "${file.originalname}"`);
      console.log(`📁 General file upload - Sanitized: "${safeFilename}"`);
      
      cb(null, safeFilename);
    } catch (error) {
      console.error('❌ Error generating safe filename:', error);
      const fallbackName = `file_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname).toLowerCase()}`;
      cb(null, fallbackName);
    }
  }
});

const fileFilter = (req, file, cb) => {
  // Allow specific file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    console.log(`✅ File type accepted: ${file.mimetype}`);
    cb(null, true);
  } else {
    console.log(`❌ File type rejected: ${file.mimetype}`);
    cb(new Error('Invalid file type. Only documents, images, and archives are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ✅ Upload single file
router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  console.log("🎯 File upload route hit");
  console.log("User:", req.user?.email);
  console.log("File uploaded:", req.file ? req.file.filename : 'none');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
        success: false
      });
    }

    // ✅ CRITICAL: Verify file exists after upload
    if (!fs.existsSync(req.file.path)) {
      console.error(`❌ File not found after upload: ${req.file.path}`);
      return res.status(500).json({
        message: "File upload failed - file not found after upload",
        success: false
      });
    }

    const { taskId, description, category = 'general' } = req.body;

    // Save file metadata to database
    const fileDoc = new File({
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: req.user.id,
      uploaderModel: req.user.role === "faculty" ? "Faculty" : "Student",
      taskId: taskId || null,
      description: description || "",
      category
    });

    await fileDoc.save();

    console.log(`✅ File uploaded and saved: ${req.file.filename}`);

    res.status(201).json({
      message: "File uploaded successfully",
      success: true,
      file: {
        id: fileDoc._id,
        originalName: fileDoc.originalName,
        filename: fileDoc.filename,
        size: fileDoc.size,
        mimetype: fileDoc.mimetype,
        uploadedAt: fileDoc.uploadedAt,
        description: fileDoc.description,
        category: fileDoc.category
      }
    });
  } catch (err) {
    console.error("❌ File upload error:", err);
    
    // Clean up file if database save failed
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("🗑️ Cleaned up file after database error");
      } catch (unlinkError) {
        console.error("❌ Failed to cleanup file:", unlinkError);
      }
    }

    res.status(500).json({
      message: err.message || "File upload failed",
      success: false
    });
  }
});

// ✅ Upload multiple files
router.post("/upload-multiple", verifyToken, upload.array("files", 5), async (req, res) => {
  console.log("🎯 Multiple file upload route hit");
  console.log("User:", req.user?.email);
  console.log("Files uploaded:", req.files?.length || 0);
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "No files uploaded",
        success: false
      });
    }

    // ✅ CRITICAL: Verify all files exist after upload
    const missingFiles = req.files.filter(file => !fs.existsSync(file.path));
    if (missingFiles.length > 0) {
      console.error(`❌ ${missingFiles.length} files not found after upload`);
      // Cleanup existing files
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(500).json({
        message: "Some files were not uploaded correctly",
        success: false
      });
    }

    const { taskId, description, category = 'general' } = req.body;
    const uploadedFiles = [];

    for (const file of req.files) {
      const fileDoc = new File({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        uploadedBy: req.user.id,
        uploaderModel: req.user.role === "faculty" ? "Faculty" : "Student",
        taskId: taskId || null,
        description: description || "",
        category
      });

      await fileDoc.save();
      uploadedFiles.push({
        id: fileDoc._id,
        originalName: fileDoc.originalName,
        filename: fileDoc.filename,
        size: fileDoc.size,
        mimetype: fileDoc.mimetype,
        uploadedAt: fileDoc.uploadedAt
      });
    }

    console.log(`✅ ${uploadedFiles.length} files uploaded and saved`);

    res.status(201).json({
      message: `${uploadedFiles.length} files uploaded successfully`,
      success: true,
      files: uploadedFiles
    });
  } catch (err) {
    console.error("❌ Multiple file upload error:", err);
    
    // Clean up files if database save failed
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file: ${file.filename}`);
          } catch (unlinkError) {
            console.error(`❌ Failed to cleanup file: ${file.filename}`, unlinkError);
          }
        }
      });
    }

    res.status(500).json({
      message: "File upload failed",
      success: false
    });
  }
});

// ✅ Get file by ID with enhanced security
router.get("/:fileId", verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId)
      .populate("uploadedBy", "firstName lastName email");

    if (!file) {
      return res.status(404).json({
        message: "File not found",
        success: false
      });
    }

    // Check access permissions
    const isOwner = file.uploadedBy._id.toString() === req.user.id;
    const isFaculty = req.user.role === "faculty";
    
    if (!isOwner && !isFaculty) {
      // Check if user has access to the task this file belongs to
      if (file.taskId) {
        const Task = require("../models/taskSchema");
        const task = await Task.findById(file.taskId).populate("team", "members");
        
        if (!task || !task.team.members.includes(req.user.id)) {
          return res.status(403).json({
            message: "Access denied",
            success: false
          });
        }
      } else {
        return res.status(403).json({
          message: "Access denied",
          success: false
        });
      }
    }

    // ✅ SECURITY: Verify file exists before serving
    if (!fs.existsSync(file.path)) {
      console.error(`❌ File not found on disk: ${file.path}`);
      return res.status(404).json({
        message: "File not found on server",
        success: false
      });
    }

    // Get file stats
    const stats = fs.statSync(file.path);
    
    // Set appropriate headers
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);
    
    // For images, display inline; for documents, download
    const isImage = file.mimetype && file.mimetype.startsWith('image/');
    if (isImage) {
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    }
    
    // Stream the file
    const fileStream = fs.createReadStream(file.path);
    fileStream.pipe(res);

    console.log(`📥 File served: ${file.filename} to ${req.user.email}`);

  } catch (err) {
    console.error("❌ File retrieval error:", err);
    res.status(500).json({
      message: "Failed to retrieve file",
      success: false
    });
  }
});

// ✅ Get files for a specific task
router.get("/task/:taskId", verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Verify user has access to this task
    const Task = require("../models/taskSchema");
    const task = await Task.findById(taskId).populate("team", "members");
    
    if (!task) {
      return res.status(404).json({
        message: "Task not found",
        success: false
      });
    }

    const isTeamMember = task.team.members.includes(req.user.id);
    const isFaculty = req.user.role === "faculty";
    
    if (!isTeamMember && !isFaculty) {
      return res.status(403).json({
        message: "Access denied",
        success: false
      });
    }

    const files = await File.find({ taskId })
      .populate("uploadedBy", "firstName lastName email")
      .sort({ uploadedAt: -1 });

    // Filter out files that don't exist on disk
    const existingFiles = files.filter(file => {
      const exists = fs.existsSync(file.path);
      if (!exists) {
        console.warn(`⚠️ File in database but not on disk: ${file.path}`);
      }
      return exists;
    });

    res.status(200).json({
      success: true,
      files: existingFiles.map(file => ({
        id: file._id,
        originalName: file.originalName,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: file.uploadedAt,
        description: file.description,
        category: file.category,
        uploadedBy: {
          name: `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`,
          email: file.uploadedBy.email
        }
      })),
      total: existingFiles.length
    });

  } catch (err) {
    console.error("❌ Error fetching task files:", err);
    res.status(500).json({
      message: "Failed to fetch files",
      success: false
    });
  }
});

// ✅ Get user's files
router.get("/user/my-files", verifyToken, async (req, res) => {
  try {
    const { category, limit = 20, page = 1 } = req.query;
    
    const query = { uploadedBy: req.user.id };
    if (category && category !== 'all') {
      query.category = category;
    }

    const files = await File.find(query)
      .populate("uploadedBy", "firstName lastName email")
      .sort({ uploadedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await File.countDocuments(query);

    // Filter out files that don't exist on disk
    const existingFiles = files.filter(file => {
      const exists = fs.existsSync(file.path);
      if (!exists) {
        console.warn(`⚠️ File in database but not on disk: ${file.path}`);
      }
      return exists;
    });

    res.status(200).json({
      success: true,
      files: existingFiles.map(file => ({
        id: file._id,
        originalName: file.originalName,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: file.uploadedAt,
        description: file.description,
        category: file.category,
        downloadCount: file.downloadCount || 0
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("❌ Error fetching user files:", err);
    res.status(500).json({
      message: "Failed to fetch files",
      success: false
    });
  }
});

// ✅ Delete file
router.delete("/:fileId", verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        message: "File not found",
        success: false
      });
    }

    // Check permissions - only owner or faculty can delete
    const isOwner = file.uploadedBy.toString() === req.user.id;
    const isFaculty = req.user.role === "faculty";
    
    if (!isOwner && !isFaculty) {
      return res.status(403).json({
        message: "Access denied. Only file owner or faculty can delete files.",
        success: false
      });
    }

    // Delete file from disk
    if (fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
        console.log(`🗑️ File deleted from disk: ${file.path}`);
      } catch (unlinkError) {
        console.error(`❌ Failed to delete file from disk: ${file.path}`, unlinkError);
        // Continue to delete from database even if disk deletion fails
      }
    } else {
      console.warn(`⚠️ File not found on disk during deletion: ${file.path}`);
    }

    // Delete from database
    await File.findByIdAndDelete(fileId);

    console.log(`✅ File deleted: ${file.filename} by ${req.user.email}`);

    res.status(200).json({
      message: "File deleted successfully",
      success: true
    });
  } catch (err) {
    console.error("❌ Error deleting file:", err);
    res.status(500).json({
      message: "Failed to delete file",
      success: false
    });
  }
});

// ✅ Update file metadata
router.put("/:fileId", verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { description, category } = req.body;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        message: "File not found",
        success: false
      });
    }

    // Check permissions - only owner can update
    if (file.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Access denied. Only file owner can update metadata.",
        success: false
      });
    }

    // Update metadata
    if (description !== undefined) {
      file.description = description;
    }
    if (category !== undefined) {
      file.category = category;
    }

    await file.save();

    console.log(`✅ File metadata updated: ${file.filename} by ${req.user.email}`);

    res.status(200).json({
      message: "File metadata updated successfully",
      success: true,
      file: {
        id: file._id,
        originalName: file.originalName,
        description: file.description,
        category: file.category
      }
    });
  } catch (err) {
    console.error("❌ Error updating file metadata:", err);
    res.status(500).json({
      message: "Failed to update file metadata",
      success: false
    });
  }
});

// ✅ Get file statistics
router.get("/stats/overview", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = {};
    if (userRole !== 'faculty') {
      query.uploadedBy = userId; // Students can only see their own stats
    }

    const totalFiles = await File.countDocuments(query);
    const totalSize = await File.aggregate([
      { $match: query },
      { $group: { _id: null, totalSize: { $sum: "$size" } } }
    ]);

    const filesByCategory = await File.aggregate([
      { $match: query },
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);

    const filesByType = await File.aggregate([
      { $match: query },
      { $group: { _id: "$mimetype", count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalFiles,
        totalSize: totalSize[0]?.totalSize || 0,
        filesByCategory,
        filesByType: filesByType.slice(0, 10) // Top 10 file types
      }
    });

  } catch (err) {
    console.error("❌ Error fetching file statistics:", err);
    res.status(500).json({
      message: "Failed to fetch file statistics",
      success: false
    });
  }
});

module.exports = router;