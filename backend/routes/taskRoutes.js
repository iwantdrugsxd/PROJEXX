// backend/routes/taskRoutes.js - NO JWT TOKEN VERSION
const express = require('express');
const router = express.Router();

// Import models
const Task = require('../models/taskSchema');
const Student = require('../models/studentSchema');
const Faculty = require('../models/facultySchema');
const ProjectServer = require('../models/projectServerSchema');
const StudentTeam = require('../models/studentTeamSchema');

// Utility function for consistent logging
const logWithTimestamp = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [TASKS] [${level.toUpperCase()}] ${message}`, data);
};

// ✅ HEALTH CHECK ENDPOINT
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    route: 'tasks',
    authentication: 'disabled',
    availableEndpoints: [
      'POST /create - Create task (Faculty)',
      'GET /student-tasks?studentId=ID - Get student tasks',
      'GET /faculty-tasks?facultyId=ID - Get faculty tasks',
      'POST /:taskId/submit - Submit task',
      'GET /:taskId - Get task details',
      'PUT /:taskId - Update task',
      'DELETE /:taskId - Delete task'
    ]
  });
});

// ✅ CREATE TASK - NO TOKEN
router.post('/create', async (req, res) => {
  try {
    const { 
      title, 
      description, 
      dueDate, 
      maxPoints, 
      priority, 
      allowFileUpload, 
      server, 
      team, 
      facultyId, 
      userRole 
    } = req.body;

    logWithTimestamp('info', 'Task creation attempt', {
      facultyId: facultyId,
      userRole: userRole,
      title: title
    });

    // Validation
    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId is required in request body',
        example: {
          title: "Assignment 1",
          description: "Complete the assignment",
          dueDate: "2025-08-01T23:59:59.000Z",
          maxPoints: 100,
          server: "server_id",
          facultyId: "faculty_id",
          userRole: "faculty"
        }
      });
    }

    const role = userRole || 'faculty';
    if (role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Only faculty can create tasks'
      });
    }

    if (!title || !description || !server) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and server are required'
      });
    }

    // Verify faculty exists
    const faculty = await Faculty.findById(facultyId);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    // Verify server exists and faculty owns it
    const projectServer = await ProjectServer.findById(server);
    if (!projectServer) {
      return res.status(404).json({
        success: false,
        message: 'Project server not found'
      });
    }

    if (projectServer.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only create tasks for your own servers'
      });
    }

    // If team is specified, verify it exists and belongs to the server
    if (team) {
      const studentTeam = await StudentTeam.findById(team);
      if (!studentTeam) {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      }

      if (studentTeam.projectServer !== projectServer.code) {
        return res.status(400).json({
          success: false,
          message: 'Team does not belong to the specified server'
        });
      }
    }

    // Create task
    const newTask = new Task({
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
      maxPoints: maxPoints || 100,
      priority: priority || 'medium',
      allowFileUpload: allowFileUpload || false,
      server: server,
      team: team || null,
      faculty: facultyId,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      submissions: []
    });

    await newTask.save();

    // Populate task for response
    const populatedTask = await Task.findById(newTask._id)
      .populate('faculty', 'firstName lastName email')
      .populate('server', 'title code')
      .populate('team', 'name members');

    logWithTimestamp('info', 'Task created successfully', {
      taskId: newTask._id,
      title: title,
      facultyId: facultyId,
      serverId: server
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: populatedTask
    });

  } catch (error) {
    logWithTimestamp('error', 'Task creation failed', {
      error: error.message,
      stack: error.stack,
      facultyId: req.body.facultyId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET STUDENT TASKS - NO TOKEN
router.get('/student-tasks', async (req, res) => {
  try {
    const { studentId } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId query parameter is required',
        example: 'GET /api/tasks/student-tasks?studentId=507f1f77bcf86cd799439011'
      });
    }

    logWithTimestamp('info', 'Fetching student tasks', {
      studentId: studentId
    });

    // Get teams the student is part of
    const studentTeams = await StudentTeam.find({ 
      members: studentId 
    });

    const teamIds = studentTeams.map(team => team._id);
    const serverCodes = [...new Set(studentTeams.map(team => team.projectServer))];

    // Get servers from codes
    const servers = await ProjectServer.find({ 
      code: { $in: serverCodes } 
    });
    const serverIds = servers.map(server => server._id);

    // Find tasks that are either:
    // 1. Assigned to teams the student is in, OR
    // 2. General tasks for servers the student has access to (no specific team)
    const tasks = await Task.find({
      $or: [
        { team: { $in: teamIds } },
        { 
          server: { $in: serverIds },
          team: null 
        }
      ]
    })
    .populate('faculty', 'firstName lastName email')
    .populate('server', 'title code')
    .populate('team', 'name members')
    .sort({ createdAt: -1 });

    // Add submission status for each task
    const tasksWithSubmissions = tasks.map(task => {
      const taskObj = task.toObject();
      
      // Check if student has submitted
      const studentSubmission = task.submissions.find(sub => 
        sub.student && sub.student.toString() === studentId
      );

      taskObj.hasSubmission = !!studentSubmission;
      taskObj.submissionStatus = studentSubmission ? 
        (studentSubmission.grade !== null ? 'graded' : 'submitted') : 
        'not_submitted';
      taskObj.grade = studentSubmission?.grade || null;
      taskObj.submissionDate = studentSubmission?.submittedAt || null;
      taskObj.feedback = studentSubmission?.feedback || null;

      return taskObj;
    });

    logWithTimestamp('info', 'Student tasks fetched successfully', {
      studentId: studentId,
      taskCount: tasks.length,
      teamCount: studentTeams.length
    });

    res.json({
      success: true,
      tasks: tasksWithSubmissions,
      totalTasks: tasks.length,
      message: tasks.length === 0 ? 
        'No tasks found. Join teams or servers to see assignments.' : 
        `Found ${tasks.length} tasks`
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching student tasks', {
      error: error.message,
      stack: error.stack,
      studentId: req.query.studentId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET FACULTY TASKS - NO TOKEN
router.get('/faculty-tasks', async (req, res) => {
  try {
    const { facultyId } = req.query;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId query parameter is required',
        example: 'GET /api/tasks/faculty-tasks?facultyId=507f1f77bcf86cd799439012'
      });
    }

    logWithTimestamp('info', 'Fetching faculty tasks', {
      facultyId: facultyId
    });

    const tasks = await Task.find({ faculty: facultyId })
      .populate('faculty', 'firstName lastName email')
      .populate('server', 'title code')
      .populate('team', 'name members')
      .sort({ createdAt: -1 });

    // Add submission statistics for each task
    const tasksWithStats = tasks.map(task => {
      const taskObj = task.toObject();
      
      const submissionStats = {
        totalSubmissions: task.submissions.length,
        gradedSubmissions: task.submissions.filter(sub => sub.grade !== null).length,
        pendingGrading: task.submissions.filter(sub => sub.grade === null).length,
        averageGrade: 0
      };

      const gradedSubmissions = task.submissions.filter(sub => sub.grade !== null);
      if (gradedSubmissions.length > 0) {
        submissionStats.averageGrade = 
          gradedSubmissions.reduce((sum, sub) => sum + sub.grade, 0) / gradedSubmissions.length;
      }

      taskObj.submissionStats = submissionStats;
      return taskObj;
    });

    logWithTimestamp('info', 'Faculty tasks fetched successfully', {
      facultyId: facultyId,
      taskCount: tasks.length
    });

    res.json({
      success: true,
      tasks: tasksWithStats,
      totalTasks: tasks.length
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching faculty tasks', {
      error: error.message,
      facultyId: req.query.facultyId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ SUBMIT TASK - NO TOKEN
router.post('/:taskId/submit', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { textSubmission, studentId, userRole } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId is required in request body',
        example: {
          textSubmission: "My assignment submission",
          studentId: "507f1f77bcf86cd799439011",
          userRole: "student"
        }
      });
    }

    const role = userRole || 'student';
    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit tasks'
      });
    }

    const task = await Task.findById(taskId)
      .populate('server', 'title code')
      .populate('team', 'name members');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if student has access to this task
    let hasAccess = false;

    if (task.team) {
      // Task is assigned to a specific team
      hasAccess = task.team.members.some(member => 
        member.toString() === studentId
      );
    } else {
      // General task for server - check if student has access to the server
      const studentTeams = await StudentTeam.find({ 
        members: studentId,
        projectServer: task.server.code
      });
      hasAccess = studentTeams.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this task'
      });
    }

    // Check if already submitted
    const existingSubmission = task.submissions.find(sub => 
      sub.student && sub.student.toString() === studentId
    );

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted this task',
        submissionDate: existingSubmission.submittedAt
      });
    }

    // Check if past due date
    if (task.dueDate && new Date() > new Date(task.dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Task submission deadline has passed',
        dueDate: task.dueDate
      });
    }

    // Add submission
    const submission = {
      student: studentId,
      textSubmission: textSubmission?.trim() || '',
      submittedAt: new Date(),
      grade: null,
      feedback: null
    };

    task.submissions.push(submission);
    task.updatedAt = new Date();
    await task.save();

    logWithTimestamp('info', 'Task submitted successfully', {
      taskId: taskId,
      studentId: studentId,
      taskTitle: task.title
    });

    res.json({
      success: true,
      message: 'Task submitted successfully',
      submission: {
        submittedAt: submission.submittedAt,
        textSubmission: submission.textSubmission
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Task submission failed', {
      error: error.message,
      taskId: req.params.taskId,
      studentId: req.body.studentId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to submit task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TASK DETAILS - NO TOKEN
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId, userRole } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId query parameter is required',
        example: 'GET /api/tasks/12345?userId=507f1f77bcf86cd799439011&userRole=student'
      });
    }

    const task = await Task.findById(taskId)
      .populate('faculty', 'firstName lastName email')
      .populate('server', 'title code')
      .populate('team', 'name members')
      .populate('submissions.student', 'firstName lastName email studentId');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const role = userRole || 'student';
    let taskData = task.toObject();

    if (role === 'student') {
      // Check if student has access
      let hasAccess = false;

      if (task.team) {
        hasAccess = task.team.members.some(member => 
          member.toString() === userId
        );
      } else {
        const studentTeams = await StudentTeam.find({ 
          members: userId,
          projectServer: task.server.code
        });
        hasAccess = studentTeams.length > 0;
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this task'
        });
      }

      // For students, only show their own submission
      const studentSubmission = task.submissions.find(sub => 
        sub.student && sub.student._id.toString() === userId
      );

      taskData.submissions = studentSubmission ? [studentSubmission] : [];
      taskData.hasSubmission = !!studentSubmission;
      taskData.submissionStatus = studentSubmission ? 
        (studentSubmission.grade !== null ? 'graded' : 'submitted') : 
        'not_submitted';
      
    } else if (role === 'faculty') {
      // Check if faculty owns this task
      if (task.faculty._id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own tasks'
        });
      }

      // For faculty, show all submissions with stats
      taskData.submissionStats = {
        totalSubmissions: task.submissions.length,
        gradedSubmissions: task.submissions.filter(sub => sub.grade !== null).length,
        pendingGrading: task.submissions.filter(sub => sub.grade === null).length,
        averageGrade: 0
      };

      const gradedSubmissions = task.submissions.filter(sub => sub.grade !== null);
      if (gradedSubmissions.length > 0) {
        taskData.submissionStats.averageGrade = 
          gradedSubmissions.reduce((sum, sub) => sum + sub.grade, 0) / gradedSubmissions.length;
      }
    }

    res.json({
      success: true,
      task: taskData
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching task details', {
      error: error.message,
      taskId: req.params.taskId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch task details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ UPDATE TASK - NO TOKEN (Faculty only)
router.put('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, dueDate, maxPoints, priority, facultyId, userRole } = req.body;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId is required in request body'
      });
    }

    const role = userRole || 'faculty';
    if (role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Only faculty can update tasks'
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check ownership
    if (task.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own tasks'
      });
    }

    // Update fields
    const updateData = { updatedAt: new Date() };
    if (title) updateData.title = title.trim();
    if (description) updateData.description = description.trim();
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (maxPoints) updateData.maxPoints = maxPoints;
    if (priority) updateData.priority = priority;

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('faculty', 'firstName lastName email')
    .populate('server', 'title code')
    .populate('team', 'name members');

    logWithTimestamp('info', 'Task updated successfully', {
      taskId: taskId,
      facultyId: facultyId,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask
    });

  } catch (error) {
    logWithTimestamp('error', 'Task update failed', {
      error: error.message,
      taskId: req.params.taskId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ DELETE TASK - NO TOKEN (Faculty only)
router.delete('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { facultyId, userRole } = req.body;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId is required in request body'
      });
    }

    const role = userRole || 'faculty';
    if (role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Only faculty can delete tasks'
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check ownership
    if (task.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own tasks'
      });
    }

    await Task.findByIdAndDelete(taskId);

    logWithTimestamp('info', 'Task deleted successfully', {
      taskId: taskId,
      taskTitle: task.title,
      facultyId: facultyId
    });

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    logWithTimestamp('error', 'Task deletion failed', {
      error: error.message,
      taskId: req.params.taskId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GRADE SUBMISSION - NO TOKEN (Faculty only)
router.post('/:taskId/grade', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { studentId, grade, feedback, facultyId, userRole } = req.body;

    if (!facultyId || !studentId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId and studentId are required',
        example: {
          studentId: "507f1f77bcf86cd799439011",
          grade: 85,
          feedback: "Good work!",
          facultyId: "507f1f77bcf86cd799439012",
          userRole: "faculty"
        }
      });
    }

    const role = userRole || 'faculty';
    if (role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Only faculty can grade submissions'
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check ownership
    if (task.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only grade submissions for your own tasks'
      });
    }

    // Find submission
    const submission = task.submissions.find(sub => 
      sub.student && sub.student.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found for this student'
      });
    }

    // Validate grade
    if (grade < 0 || grade > task.maxPoints) {
      return res.status(400).json({
        success: false,
        message: `Grade must be between 0 and ${task.maxPoints}`
      });
    }

    // Update submission
    submission.grade = grade;
    submission.feedback = feedback?.trim() || '';
    submission.gradedAt = new Date();

    task.updatedAt = new Date();
    await task.save();

    logWithTimestamp('info', 'Submission graded successfully', {
      taskId: taskId,
      studentId: studentId,
      grade: grade,
      facultyId: facultyId
    });

    res.json({
      success: true,
      message: 'Submission graded successfully',
      grade: {
        grade: grade,
        feedback: submission.feedback,
        gradedAt: submission.gradedAt
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Grading submission failed', {
      error: error.message,
      taskId: req.params.taskId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to grade submission',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;