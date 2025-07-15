// backend/routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const Task = require("../models/taskSchema");
const StudentTeam = require("../models/studentTeamSchema");
const Student = require("../models/studentSchema");
const Faculty = require("../models/facultySchema");
const File = require("../models/fileSchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 taskRoutes.js loaded");

// ✅ Create new task
router.post("/create", verifyToken, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      assignmentType, 
      teamId, 
      projectServerCode, 
      priority = "medium", 
      dueDate,
      attachments = [],
      maxGrade = 100,
      instructions = ""
    } = req.body;

    // Determine creator model
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
      const team = await StudentTeam.findById(teamId).populate("members");
      if (!team) {
        return res.status(404).json({ 
          message: "Team not found",
          success: false 
        });
      }
      teamsToAssign = [team];
    } else if (assignmentType === 'all') {
      // Assign to all teams in the project server
      const teams = await StudentTeam.find({ projectServer: projectServerCode }).populate("members");
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
      const isTeamMember = team.members.some(member => member._id.toString() === req.user.id);
      const isTeamCreator = team.creator && team.creator.toString() === req.user.id;
      
      if (req.user.role === "student" && !isTeamMember && !isTeamCreator) {
        return res.status(403).json({ 
          message: `You don't have permission to create tasks for team: ${team.name}`,
          success: false 
        });
      }
    }

    // Validate attachments if provided
    if (attachments.length > 0) {
      const validFiles = await File.find({ 
        _id: { $in: attachments },
        uploadedBy: req.user.id 
      });
      
      if (validFiles.length !== attachments.length) {
        return res.status(400).json({ 
          message: "Some attachment files are invalid or not accessible",
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
        instructions: instructions?.trim() || "",
        team: team._id,
        createdBy,
        creatorModel,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        attachments: attachments || [],
        maxGrade,
        projectServer: team.projectServer
      });

      const savedTask = await task.save();
      
      // Populate the task for response
      const populatedTask = await Task.findById(savedTask._id)
        .populate("createdBy", "firstName lastName email")
        .populate("team", "name members")
        .populate("attachments", "originalName size mimetype")
        .populate("submissionFiles", "originalName size mimetype");
      
      createdTasks.push(populatedTask);
    }

    console.log(`✅ Created ${createdTasks.length} task(s): "${title}" by ${req.user.role} ${req.user.id}`);

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
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get tasks for faculty
router.get("/faculty-tasks", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Access denied. Faculty access required.",
        success: false 
      });
    }

    const { status, priority, teamId, limit = 50, page = 1 } = req.query;

    // Build query filters
    const filters = { createdBy: req.user.id };
    if (status && status !== "all") filters.status = status;
    if (priority && priority !== "all") filters.priority = priority;
    if (teamId) filters.team = teamId;

    const tasks = await Task.find(filters)
      .populate("createdBy", "firstName lastName email")
      .populate("team", "name members projectServer")
      .populate("attachments", "originalName size mimetype uploadedAt")
      .populate("submissionFiles", "originalName size mimetype uploadedAt")
      .populate("submittedBy", "firstName lastName email")
      .populate("gradedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalTasks = await Task.countDocuments(filters);

    console.log(`Faculty ${req.user.id} retrieved ${tasks.length} tasks`);

    res.status(200).json({
      success: true,
      tasks,
      totalTasks,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalTasks / parseInt(limit)),
      message: tasks.length === 0 ? "No tasks found" : `Found ${tasks.length} tasks`
    });
  } catch (err) {
    console.error("Error fetching faculty tasks:", err);
    res.status(500).json({ 
      message: "Failed to fetch tasks", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get tasks for student
router.get("/student-tasks", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Access denied. Student access required.",
        success: false 
      });
    }

    const { status, priority, limit = 50, page = 1 } = req.query;

    // Get student's teams
    const student = await Student.findById(req.user.id).populate("joinedTeams");
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
      .populate("team", "name members projectServer")
      .populate("attachments", "originalName size mimetype uploadedAt")
      .populate("submissionFiles", "originalName size mimetype uploadedAt")
      .populate("submittedBy", "firstName lastName email")
      .populate("gradedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalTasks = await Task.countDocuments(filters);

    console.log(`Student ${req.user.id} retrieved ${tasks.length} tasks from ${teamIds.length} teams`);

    res.status(200).json({
      success: true,
      tasks,
      totalTasks,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalTasks / parseInt(limit)),
      message: tasks.length === 0 ? "No tasks assigned yet" : `Found ${tasks.length} tasks`
    });
  } catch (err) {
    console.error("Error fetching student tasks:", err);
    res.status(500).json({ 
      message: "Failed to fetch tasks", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
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
      .populate("team", "name members projectServer")
      .populate("attachments", "originalName size mimetype uploadedAt uploadedBy")
      .populate("submissionFiles", "originalName size mimetype uploadedAt uploadedBy")
      .populate("submittedBy", "firstName lastName email")
      .populate("gradedBy", "firstName lastName email")
      .populate("comments.author", "firstName lastName email");

    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Check access permissions
    const isCreator = task.createdBy._id.toString() === req.user.id;
    const isTeamMember = task.team.members.some(member => member._id.toString() === req.user.id);
    const isFaculty = req.user.role === "faculty";
    
    if (!isCreator && !isTeamMember && !isFaculty) {
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
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
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
        message: "Invalid status. Valid statuses: " + validStatuses.join(", "),
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
    const isTeamMember = task.team.members.some(member => member._id.toString() === req.user.id);
    const isCreator = task.createdBy.toString() === req.user.id;
    const isFaculty = req.user.role === "faculty";
    
    if (req.user.role === "student" && !isTeamMember) {
      return res.status(403).json({ 
        message: "Access denied. You must be a team member to update this task.",
        success: false 
      });
    }

    // Students can only change to in-progress, faculty can change to any status
    if (req.user.role === "student" && !["in-progress"].includes(status)) {
      return res.status(403).json({ 
        message: "Students can only change task status to 'in-progress'",
        success: false 
      });
    }

    const oldStatus = task.status;
    task.status = status;
    task.updatedAt = new Date();

    // Set timestamps based on status
    if (status === "in-progress" && oldStatus === "pending") {
      task.startedAt = new Date();
      task.startedBy = req.user.id;
    } else if (status === "submitted" && oldStatus !== "submitted") {
      task.submittedAt = new Date();
      task.submittedBy = req.user.id;
    } else if (["approved", "rejected"].includes(status)) {
      task.gradedAt = new Date();
      task.gradedBy = req.user.id;
    }

    await task.save();

    console.log(`✅ Task ${taskId} status changed from "${oldStatus}" to "${status}" by ${req.user.role} ${req.user.id}`);

    res.status(200).json({
      message: "Task status updated successfully",
      success: true,
      task: {
        _id: task._id,
        status: task.status,
        updatedAt: task.updatedAt
      }
    });
  } catch (err) {
    console.error("Error updating task status:", err);
    res.status(500).json({ 
      message: "Error updating task status", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Submit task with files
router.post("/:taskId/submit", verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { submissionText, fileIds = [] } = req.body;

    const task = await Task.findById(taskId).populate("team", "members");
    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Check if user is team member
    const isTeamMember = task.team.members.some(member => member._id.toString() === req.user.id);
    if (!isTeamMember) {
      return res.status(403).json({ 
        message: "Access denied. You must be a team member to submit this task.",
        success: false 
      });
    }

    // Check if task is already submitted
    if (task.status === "submitted") {
      return res.status(400).json({ 
        message: "Task has already been submitted",
        success: false 
      });
    }

    // Validate submitted files belong to the user or team
    if (fileIds.length > 0) {
      const validFiles = await File.find({ 
        _id: { $in: fileIds },
        $or: [
          { uploadedBy: req.user.id },
          { taskId: taskId }
        ]
      });
      
      if (validFiles.length !== fileIds.length) {
        return res.status(400).json({ 
          message: "Some submitted files are invalid or not accessible",
          success: false 
        });
      }
    }

    // Update task with submission
    task.status = 'submitted';
    task.submissionText = submissionText || "";
    task.submissionFiles = fileIds;
    task.submittedAt = new Date();
    task.submittedBy = req.user.id;
    task.updatedAt = new Date();

    await task.save();

    // Populate the updated task
    const populatedTask = await Task.findById(taskId)
      .populate("submissionFiles", "originalName size mimetype uploadedAt")
      .populate("submittedBy", "firstName lastName email");

    console.log(`✅ Task ${taskId} submitted by student ${req.user.id} with ${fileIds.length} files`);

    res.status(200).json({
      message: "Task submitted successfully",
      success: true,
      task: populatedTask
    });
  } catch (err) {
    console.error("Error submitting task:", err);
    res.status(500).json({ 
      message: "Failed to submit task", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Grade task (Faculty only)
router.post("/:taskId/grade", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can grade tasks",
        success: false 
      });
    }

    const { taskId } = req.params;
    const { grade, feedback, status = "approved" } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Validate grade
    if (grade !== undefined) {
      const gradeNum = parseFloat(grade);
      if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > task.maxGrade) {
        return res.status(400).json({ 
          message: `Grade must be a number between 0 and ${task.maxGrade}`,
          success: false 
        });
      }
      task.grade = gradeNum;
    }

    // Validate status
    if (!["approved", "rejected", "needs-revision"].includes(status)) {
      return res.status(400).json({ 
        message: "Invalid grading status",
        success: false 
      });
    }

    task.status = status;
    task.feedback = feedback || "";
    task.gradedAt = new Date();
    task.gradedBy = req.user.id;
    task.updatedAt = new Date();

    await task.save();

    const populatedTask = await Task.findById(taskId)
      .populate("gradedBy", "firstName lastName email");

    console.log(`✅ Task ${taskId} graded by faculty ${req.user.id} - Grade: ${grade}, Status: ${status}`);

    res.status(200).json({
      message: "Task graded successfully",
      success: true,
      task: populatedTask
    });
  } catch (err) {
    console.error("Error grading task:", err);
    res.status(500).json({ 
      message: "Failed to grade task", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
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
    const isTeamMember = task.team.members.some(member => member._id.toString() === req.user.id);
    const isCreator = task.createdBy.toString() === req.user.id;
    const isFaculty = req.user.role === "faculty";
    
    if (req.user.role === "student" && !isTeamMember && !isCreator) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    const authorModel = req.user.role === "faculty" ? "Faculty" : "Student";

    const comment = {
      author: req.user.id,
      authorModel,
      message: message.trim(),
      createdAt: new Date()
    };

    task.comments.push(comment);
    task.updatedAt = new Date();
    await task.save();

    // Populate the new comment
    const updatedTask = await Task.findById(taskId)
      .populate("comments.author", "firstName lastName email");
    
    const newComment = updatedTask.comments[updatedTask.comments.length - 1];

    console.log(`✅ Comment added to task ${taskId} by ${req.user.role} ${req.user.id}`);

    res.status(201).json({
      message: "Comment added successfully",
      success: true,
      comment: newComment
    });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ 
      message: "Error adding comment", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Update task (Creator only)
router.put("/:taskId", verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, instructions, priority, dueDate, maxGrade } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Check if user is the creator
    if (task.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "Only task creator can update the task",
        success: false 
      });
    }

    // Don't allow updates if task is submitted and graded
    if (task.status === "approved" || task.status === "rejected") {
      return res.status(400).json({ 
        message: "Cannot update graded tasks",
        success: false 
      });
    }

    // Update fields if provided
    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (instructions !== undefined) task.instructions = instructions.trim();
    if (priority) task.priority = priority;
    if (dueDate) task.dueDate = new Date(dueDate);
    if (maxGrade !== undefined) task.maxGrade = parseInt(maxGrade);
    
    task.updatedAt = new Date();

    await task.save();

    const populatedTask = await Task.findById(taskId)
      .populate("createdBy", "firstName lastName email")
      .populate("team", "name")
      .populate("attachments", "originalName size mimetype");

    console.log(`✅ Task ${taskId} updated by ${req.user.role} ${req.user.id}`);

    res.status(200).json({
      message: "Task updated successfully",
      success: true,
      task: populatedTask
    });
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ 
      message: "Failed to update task", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Delete task (Creator only)
router.delete("/:taskId", verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: "Task not found",
        success: false 
      });
    }

    // Check if user is the creator
    if (task.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "Only task creator can delete the task",
        success: false 
      });
    }

    // Don't allow deletion if task has submissions
    if (task.status === "submitted" || task.status === "approved") {
      return res.status(400).json({ 
        message: "Cannot delete tasks with submissions",
        success: false 
      });
    }

    await Task.findByIdAndDelete(taskId);

    console.log(`✅ Task ${taskId} deleted by ${req.user.role} ${req.user.id}`);

    res.status(200).json({
      message: "Task deleted successfully",
      success: true
    });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ 
      message: "Failed to delete task", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get task statistics (Faculty only)
router.get("/stats/overview", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Access denied. Faculty access required.",
        success: false 
      });
    }

    const stats = await Task.aggregate([
      { $match: { createdBy: req.user.id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgGrade: { $avg: "$grade" }
        }
      }
    ]);

    const totalTasks = await Task.countDocuments({ createdBy: req.user.id });
    const overdueTasks = await Task.countDocuments({
      createdBy: req.user.id,
      dueDate: { $lt: new Date() },
      status: { $nin: ["approved", "rejected"] }
    });

    res.status(200).json({
      success: true,
      stats: {
        total: totalTasks,
        overdue: overdueTasks,
        byStatus: stats
      }
    });
  } catch (err) {
    console.error("Error fetching task stats:", err);
    res.status(500).json({ 
      message: "Failed to fetch task statistics", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

console.log("🔧 All task routes defined successfully");

module.exports = router;