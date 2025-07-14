// routes/taskRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const Task = require("../models/taskSchema");
const Student = require("../models/studentSchema");
const Faculty = require("../models/facultySchema");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

// Multer setup for local storage (can be swapped with S3)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// POST /tasks/create - Create a new task
router.post("/createTask", verifyToken, async (req, res) => {
  try {
    const { title, description, team } = req.body;
    const createdBy = req.user.id;
    const creatorModel = req.user.role

    const task = new Task({
      title,
      description,
      team,
      createdBy,
      creatorModel,
    });

    const savedTask = await task.save();
    res.status(201).json(savedTask);
  } catch (err) {
    res.status(500).json({ message: "Error creating task", error: err.message });
  }
});

// POST /tasks/:taskId/comment - Add a comment
router.post("/:taskId/comment", verifyToken, async (req, res) => {
  try {
    const { message, authorModel } = req.body;
    const author = req.user.id;

    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.comments.push({ message, author, authorModel });
    await task.save();

    res.status(200).json({ message: "Comment added successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error adding comment", error: err.message });
  }
});

// POST /tasks/:taskId/attachments - Upload attachment
router.post("/:taskId/attachments", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const fileData = {
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.id,
    };

    task.attachments.push(fileData);
    await task.save();

    res.status(200).json({ message: "Attachment uploaded", attachment: fileData });
  } catch (err) {
    res.status(500).json({ message: "Error uploading attachment", error: err.message });
  }
});

// GET /tasks/team/:teamId - Get all tasks for a team
router.get("/team/:teamId", verifyToken, async (req, res) => {
  try {
    const tasks = await Task.find({ team: req.params.teamId });
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ message: "Error fetching tasks", error: err.message });
  }
});

// GET /tasks/:taskId - Get task details
router.get("/:taskId", verifyToken, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate("createdBy", "firstName lastName")
      .populate("comments.author", "firstName lastName")
      .populate("attachments.uploadedBy", "firstName lastName");

    if (!task) return res.status(404).json({ message: "Task not found" });
    res.status(200).json(task);
  } catch (err) {
    res.status(500).json({ message: "Error fetching task", error: err.message });
  }
});

// PATCH /tasks/:taskId/status - Update task status
router.patch("/:taskId/status", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.status = status;
    await task.save();

    res.status(200).json({ message: "Task status updated successfully", task });
  } catch (err) {
    res.status(500).json({ message: "Error updating task status", error: err.message });
  }
});
module.exports = router;
