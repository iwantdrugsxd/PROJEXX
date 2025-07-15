// backend/routes/fileRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const File = require("../models/fileSchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 fileRoutes.js loaded");

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(uploadsDir, req.user.role);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
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
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
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
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
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

    res.status(201).json({
      message: "File uploaded successfully",
      success: true,
      file: {
        id: fileDoc._id,
        originalName: fileDoc.originalName,
        size: fileDoc.size,
        mimetype: fileDoc.mimetype,
        uploadedAt: fileDoc.uploadedAt,
        description: fileDoc.description,
        category: fileDoc.category
      }
    });
  } catch (err) {
    console.error("File upload error:", err);
    
    // Clean up file if database save failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      message: err.message || "File upload failed",
      success: false
    });
  }
});

// ✅ Upload multiple files
router.post("/upload-multiple", verifyToken, upload.array("files", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "No files uploaded",
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
        size: fileDoc.size,
        mimetype: fileDoc.mimetype,
        uploadedAt: fileDoc.uploadedAt
      });
    }

    res.status(201).json({
      message: `${uploadedFiles.length} files uploaded successfully`,
      success: true,
      files: uploadedFiles
    });
  } catch (err) {
    console.error("Multiple file upload error:", err);
    
    // Clean up files if database save failed
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      message: "File upload failed",
      success: false
    });
  }
});

// ✅ Get file by ID
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

    res.status(200).json({
      success: true,
      file: {
        id: file._id,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: file.uploadedAt,
        uploadedBy: file.uploadedBy,
        description: file.description,
        category: file.category,
        taskId: file.taskId
      }
    });
  } catch (err) {
    console.error("Error fetching file:", err);
    res.status(500).json({
      message: "Failed to fetch file",
      success: false
    });
  }
});

// ✅ Download file
router.get("/:fileId/download", verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        message: "File not found",
        success: false
      });
    }

    // Check access permissions (same as get file)
    const isOwner = file.uploadedBy.toString() === req.user.id;
    const isFaculty = req.user.role === "faculty";
    
    if (!isOwner && !isFaculty) {
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

    // Check if file exists on disk
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        message: "File not found on server",
        success: false
      });
    }

    // Update download count
    file.downloadCount = (file.downloadCount || 0) + 1;
    file.lastDownloaded = new Date();
    await file.save();

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Length', file.size);

    // Stream the file
    const fileStream = fs.createReadStream(file.path);
    fileStream.pipe(res);
  } catch (err) {
    console.error("Error downloading file:", err);
    res.status(500).json({
      message: "Failed to download file",
      success: false
    });
  }
});

// ✅ Get files for a task
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

    res.status(200).json({
      success: true,
      files: files.map(file => ({
        id: file._id,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: file.uploadedAt,
        uploadedBy: file.uploadedBy,
        description: file.description,
        category: file.category,
        downloadCount: file.downloadCount || 0
      }))
    });
  } catch (err) {
    console.error("Error fetching task files:", err);
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

    res.status(200).json({
      success: true,
      files: files.map(file => ({
        id: file._id,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: file.uploadedAt,
        description: file.description,
        category: file.category,
        taskId: file.taskId,
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
    console.error("Error fetching user files:", err);
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
      fs.unlinkSync(file.path);
    }

    // Delete from database
    await File.findByIdAndDelete(fileId);

    res.status(200).json({
      message: "File deleted successfully",
      success: true
    });
  } catch (err) {
    console.error("Error deleting file:", err);
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
        message: "Access denied. Only file owner can update file details.",
        success: false
      });
    }

    // Update metadata
    if (description !== undefined) file.description = description;
    if (category !== undefined) file.category = category;
    
    await file.save();

    res.status(200).json({
      message: "File updated successfully",
      success: true,
      file: {
        id: file._id,
        originalName: file.originalName,
        description: file.description,
        category: file.category
      }
    });
  } catch (err) {
    console.error("Error updating file:", err);
    res.status(500).json({
      message: "Failed to update file",
      success: false
    });
  }
});

console.log("🔧 All file routes defined successfully");

module.exports = router;