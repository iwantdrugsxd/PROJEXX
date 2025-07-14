const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Task = require("../models/taskSchema");
const Student = require("../models/studentSchema");
const Faculty = require("../models/facultySchema");
const StudentTeam = require("../models/studentTeamSchema");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  // Allow common file types
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('File type not supported'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ✅ Create a new task
router.post("/createTask", verifyToken, async (req, res) => {
  try {
    const { title, description, teamId, assignmentType, projectServerCode, priority = "medium", dueDate } = req.body;
    const createdBy = req.user.id;
    const creatorModel = req.user.role === "faculty" ? "Faculty" : "Student";

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ 
        message: "Task title is required",
        success: false 
      });
    }

    if (!assignmentType || (assignmentType === 'specific' && !teamId) || (assignmentType === 'all' && !projectServerCode)) {
      return res.status(400).json({ 
        message: "Assignment type and target are required",
        success: false 
      });
    }

    let teamsToAssign = [];

    if (assignmentType === 'specific') {
      // Assign to specific team
      const team = await StudentTeam.findById(teamId);
      if (!team) {
        return res.status(404).json({ 
          message: "Team not found",
          success: false 
        });
      }
      teamsToAssign = [team];
    } else if (assignmentType === 'all') {
      // Assign to all teams in the project server
      const teams = await StudentTeam.find({ projectServer: projectServerCode });
      if (teams.length === 0) {
        return res.status(404).json({ 
          message: "No teams found in this project server",
          success: false 
        });
      }
      teamsToAssign = teams;
    }

    // Check permissions for each team
    for (const team of teamsToAssign) {
      const isTeamMember = team.members.includes(req.user.id);
      const isTeamCreator = team.creator && team.creator.toString() === req.user.id;
      
      if (req.user.role === "student" && !isTeamMember && !isTeamCreator) {
        return res.status(403).json({ 
          message: `You don't have permission to create tasks for team: ${team.name}`,
          success: false 
        });
      }
    }

    // Create tasks for all selected teams
    const createdTasks = [];
    
    for (const team of teamsToAssign) {
      const task = new Task({
        title: title.trim(),
        description: description?.trim() || "",
        team: team._id,
        createdBy,
        creatorModel,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null
      });

      const savedTask = await task.save();
      
      // Populate the task for response
      const populatedTask = await Task.findById(savedTask._id)
        .populate("createdBy", "firstName lastName email")
        .populate("team", "name");
      
      createdTasks.push(populatedTask);
    }

    res.status(201).json({
      message: `Task${createdTasks.length > 1 ? 's' : ''} created successfully`,
      success: true,
      tasks: createdTasks,
      count: createdTasks.length
    });
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ 
      message: "Error creating task", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Get tasks for a team
router.get("/team/:teamId", verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { status, priority, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    // Verify team exists and user has access
    const team = await StudentTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ 
        message: "Team not found",
        success: false 
      });
    }

    const isTeamMember = team.members.includes(req.user.id);
    if (req.user.role === "student" && !isTeamMember) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    // Build query filters
    const filters = { team: teamId };
    if (status && status !== "all") filters.status = status;
    if (priority && priority !== "all") filters.priority = priority;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const tasks = await Task.find(filters)
      .populate("createdBy", "firstName lastName email")
      .populate("team", "name")
      .populate("comments.author", "firstName lastName email")
      .sort(sortOptions);

    res.status(200).json({
      success: true,
      tasks
    });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ 
      message: "Error fetching tasks", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Get single task details
router.get("/:taskId", verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .populate("createdBy", "firstName lastName email")
      .populate("team", "name members")
      .populate("comments.author", "firstName lastName email")
      .populate("attachments.uploadedBy", "firstName lastName email");

    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Check access permissions
    const isTeamMember = task.team.members.includes(req.user.id);
    if (req.user.role === "student" && !isTeamMember) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    res.status(200).json({
      success: true,
      task
    });
  } catch (err) {
    console.error("Error fetching task:", err);
    res.status(500).json({ 
      message: "Error fetching task", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Update task status
router.patch("/:taskId/status", verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "in-progress", "submitted", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status",
        success: false 
      });
    }

    const task = await Task.findById(taskId).populate("team", "members");
    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Check permissions
    const isTeamMember = task.team.members.includes(req.user.id);
    if (req.user.role === "student" && !isTeamMember) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    task.status = status;
    task.updatedAt = new Date();

    if (status === "submitted" || status === "approved") {
      task.completedAt = new Date();
    }

    await task.save();

    res.status(200).json({
      message: "Task status updated successfully",
      success: true,
      task
    });
  } catch (err) {
    console.error("Error updating task status:", err);
    res.status(500).json({ 
      message: "Error updating task status", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Add comment to task
router.post("/:taskId/comment", verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        message: "Comment message is required",
        success: false 
      });
    }

    const task = await Task.findById(taskId).populate("team", "members");
    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Check permissions
    const isTeamMember = task.team.members.includes(req.user.id);
    if (req.user.role === "student" && !isTeamMember) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    const authorModel = req.user.role === "faculty" ? "Faculty" : "Student";

    task.comments.push({ 
      message: message.trim(), 
      author: req.user.id, 
      authorModel 
    });
    
    await task.save();

    // Populate the new comment for response
    const updatedTask = await Task.findById(taskId)
      .populate("comments.author", "firstName lastName email");

    const newComment = updatedTask.comments[updatedTask.comments.length - 1];

    res.status(200).json({ 
      message: "Comment added successfully",
      success: true,
      comment: newComment 
    });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ 
      message: "Error adding comment", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Upload attachment to task
router.post("/:taskId/attachments", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!req.file) {
      return res.status(400).json({ 
        message: "No file uploaded",
        success: false 
      });
    }

    const task = await Task.findById(taskId).populate("team", "members");
    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Check permissions
    const isTeamMember = task.team.members.includes(req.user.id);
    if (req.user.role === "student" && !isTeamMember) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.id,
      size: req.file.size,
      mimetype: req.file.mimetype
    };

    task.attachments.push(fileData);
    await task.save();

    // Populate the attachment for response
    const updatedTask = await Task.findById(taskId)
      .populate("attachments.uploadedBy", "firstName lastName email");

    const newAttachment = updatedTask.attachments[updatedTask.attachments.length - 1];

    res.status(200).json({ 
      message: "Attachment uploaded successfully",
      success: true,
      attachment: newAttachment 
    });
  } catch (err) {
    console.error("Error uploading attachment:", err);
    res.status(500).json({ 
      message: "Error uploading attachment", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Get tasks assigned to student
router.get("/student/:studentId", verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status, priority } = req.query;

    // Check permissions
    if (req.user.role === "student" && req.user.id !== studentId) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    // Get student's teams
    const student = await Student.findById(studentId).populate("joinedTeams");
    if (!student) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    const teamIds = student.joinedTeams.map(team => team._id);

    // Build query filters
    const filters = { team: { $in: teamIds } };
    if (status && status !== "all") filters.status = status;
    if (priority && priority !== "all") filters.priority = priority;

    const tasks = await Task.find(filters)
      .populate("createdBy", "firstName lastName email")
      .populate("team", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      tasks
    });
  } catch (err) {
    console.error("Error fetching student tasks:", err);
    res.status(500).json({ 
      message: "Error fetching student tasks", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Delete task (only creator or faculty)
router.delete("/:taskId", verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId).populate("team", "members");
    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Check permissions - only creator or faculty can delete
    const isCreator = task.createdBy.toString() === req.user.id;
    if (req.user.role !== "faculty" && !isCreator) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    await Task.findByIdAndDelete(taskId);

    res.status(200).json({
      message: "Task deleted successfully",
      success: true
    });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ 
      message: "Error deleting task", 
      error: err.message,
      success: false 
    });
  }
});

module.exports = router;