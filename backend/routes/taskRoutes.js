// backend/routes/taskRoutes.js - NO AUTHENTICATION VERSION
const express = require('express');
const router = express.Router();
const Task = require('../models/taskSchema');
const StudentTeam = require('../models/studentTeamSchema');
const ProjectServer = require('../models/projectServerSchema');

// ✅ NO verifyToken middleware - direct access

// Enhanced logging function
const logWithTimestamp = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [TASKS] [${level.toUpperCase()}] ${message}`, data);
};

// Check if file upload support is available
let hasFileUploadSupport = false;
let Submission = null;

try {
  Submission = require('../models/submissionSchema');
  hasFileUploadSupport = true;
  console.log('✅ File upload support enabled');
} catch (error) {
  console.log('⚠️ File upload support not available (optional)');
}

// ✅ HEALTH CHECK ENDPOINT
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    route: 'tasks',
    authentication: 'disabled',
    fileUploadSupport: hasFileUploadSupport
  });
});

// ✅ MAIN ENDPOINT: GET STUDENT TASKS - Modified to accept studentId as query param
router.get('/student-tasks', async (req, res) => {
  try {
    const { studentId } = req.query;
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId query parameter is required'
      });
    }

    logWithTimestamp('info', 'Fetching student tasks', { studentId: studentId });

    // Get student teams
    const studentTeams = await StudentTeam.find({
      members: studentId
    });

    if (!studentTeams || studentTeams.length === 0) {
      logWithTimestamp('info', 'Student is not in any teams', { studentId: studentId });
      return res.json({
        success: true,
        tasks: [],
        totalTasks: 0,
        pendingTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        teams: 0,
        message: 'No teams found. Join a team to see tasks.',
        statistics: {
          completionRate: 0,
          onTimeSubmissions: 0,
          averageGrade: 0
        }
      });
    }

    const teamIds = studentTeams.map(team => team._id);
    logWithTimestamp('info', `Student is in ${teamIds.length} teams`, { studentId: studentId, teamCount: teamIds.length });

    // ✅ FIXED QUERY: Include both 'active' and 'published' statuses
    const tasks = await Task.find({
      team: { $in: teamIds },
      status: { $in: ['active', 'published'] }
    })
    .populate('server', 'title code description')
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email')
    .sort({ dueDate: 1 });

    logWithTimestamp('info', `Found ${tasks.length} tasks for student`, { studentId: studentId, taskCount: tasks.length });

    // Debug what we found
    if (tasks.length === 0) {
      logWithTimestamp('info', 'No active/published tasks found, checking all statuses...', { studentId: studentId });
      const allTasks = await Task.find({ team: { $in: teamIds } });
      logWithTimestamp('info', `Total tasks for teams (any status): ${allTasks.length}`, { studentId: studentId });
      if (allTasks.length > 0) {
        const statuses = [...new Set(allTasks.map(t => t.status))];
        logWithTimestamp('info', 'Available task statuses:', { statuses });
      }
    }

    // Process tasks and add submission status
    const tasksWithStatus = await Promise.all(tasks.map(async (task) => {
      const taskObj = task.toObject();
      
      // Initialize submission data
      let hasSubmission = false;
      let submissionData = null;

      // Check text submissions in task schema
      if (task.submissions && Array.isArray(task.submissions)) {
        const userSubmission = task.submissions.find(sub => 
          sub.student && sub.student.toString() === studentId
        );
        if (userSubmission) {
          hasSubmission = true;
          submissionData = {
            type: 'text',
            status: userSubmission.status || 'submitted',
            submittedAt: userSubmission.submittedAt,
            grade: userSubmission.grade,
            feedback: userSubmission.feedback,
            attemptNumber: userSubmission.attemptNumber || userSubmission.attempt || 1,
            isLate: userSubmission.isLate || false
          };
        }
      }

      // Check file submissions if available and no text submission found
      if (!hasSubmission && hasFileUploadSupport && Submission) {
        try {
          const fileSubmission = await Submission.findOne({
            task: task._id,
            student: studentId
          });

          if (fileSubmission) {
            hasSubmission = true;
            submissionData = {
              type: 'files',
              status: fileSubmission.status,
              submittedAt: fileSubmission.submittedAt,
              grade: fileSubmission.grade,
              feedback: fileSubmission.feedback,
              attemptNumber: fileSubmission.attemptNumber || 1,
              isLate: fileSubmission.isLate || false,
              fileCount: fileSubmission.files ? fileSubmission.files.length : 0
            };
          }
        } catch (fileErr) {
          logWithTimestamp('warn', `File submission check failed for task ${task.title}:`, { error: fileErr.message });
        }
      }

      // Set submission status
      if (hasSubmission && submissionData) {
        Object.assign(taskObj, {
          submissionStatus: submissionData.status,
          submittedAt: submissionData.submittedAt,
          grade: submissionData.grade,
          feedback: submissionData.feedback,
          attemptNumber: submissionData.attemptNumber,
          isLate: submissionData.isLate,
          hasSubmission: true,
          submissionType: submissionData.type
        });
        
        if (submissionData.fileCount) {
          taskObj.fileCount = submissionData.fileCount;
        }
      } else {
        Object.assign(taskObj, {
          submissionStatus: 'pending',
          submittedAt: null,
          grade: null,
          feedback: null,
          attemptNumber: 0,
          isLate: false,
          hasSubmission: false,
          submissionType: null
        });
      }
      
      // Add time calculations
      if (task.dueDate) {
        const now = new Date();
        const dueDate = new Date(task.dueDate);
        taskObj.timeRemaining = Math.max(0, dueDate - now);
        taskObj.isOverdue = now > dueDate && !taskObj.hasSubmission;
        taskObj.daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      }
      
      // Add team info safely
      if (task.team) {
        taskObj.teamName = task.team.name || 'Unknown Team';
        taskObj.teamMemberCount = (task.team.members && Array.isArray(task.team.members)) ? task.team.members.length : 0;
      }
      
      return taskObj;
    }));

    // Calculate statistics
    const completedTasks = tasksWithStatus.filter(t => t.hasSubmission).length;
    const pendingTasks = tasksWithStatus.filter(t => !t.hasSubmission).length;
    const overdueTasks = tasksWithStatus.filter(t => t.isOverdue).length;
    const onTimeSubmissions = Math.max(0, completedTasks - tasksWithStatus.filter(t => t.hasSubmission && t.isLate).length);

    // Calculate average grade
    const gradedTasks = tasksWithStatus.filter(t => t.grade !== null && t.grade !== undefined);
    const averageGrade = gradedTasks.length > 0 ? 
      (gradedTasks.reduce((sum, t) => sum + (t.grade || 0), 0) / gradedTasks.length) : 0;

    logWithTimestamp('info', 'Student task analytics calculated', {
      studentId: studentId,
      totalTasks: tasksWithStatus.length,
      completedTasks,
      pendingTasks,
      overdueTasks
    });

    const response = {
      success: true,
      tasks: tasksWithStatus,
      totalTasks: tasksWithStatus.length,
      pendingTasks: pendingTasks,
      completedTasks: completedTasks,
      overdueTasks: overdueTasks,
      teams: studentTeams.length,
      statistics: {
        completionRate: tasksWithStatus.length > 0 ? Math.round((completedTasks / tasksWithStatus.length) * 100) : 0,
        onTimeSubmissions: onTimeSubmissions,
        averageGrade: Math.round(averageGrade * 100) / 100
      },
      message: tasksWithStatus.length === 0 ? 
        'No tasks found for your teams.' : 
        `Found ${tasksWithStatus.length} tasks across ${studentTeams.length} teams`
    };

    res.json(response);

  } catch (error) {
    logWithTimestamp('error', 'Error fetching student tasks', {
      error: error.message,
      studentId: req.query.studentId,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? {
        studentId: req.query.studentId,
        errorType: error.name,
        errorMessage: error.message
      } : undefined
    });
  }
});

// ✅ GET FACULTY TASKS - Modified to accept facultyId as query param
router.get('/faculty-tasks', async (req, res) => {
  try {
    const { facultyId } = req.query;
    
    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId query parameter is required'
      });
    }

    logWithTimestamp('info', 'Fetching faculty tasks', { facultyId: facultyId });

    const tasks = await Task.find({
      faculty: facultyId
    })
    .populate('server', 'title code description')
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email')
    .sort({ createdAt: -1 });

    // Add submission statistics to each task
    const tasksWithStats = tasks.map(task => {
      const taskObj = task.toObject();
      
      if (task.submissions && Array.isArray(task.submissions)) {
        const totalSubmissions = task.submissions.length;
        const gradedSubmissions = task.submissions.filter(sub => sub.grade !== null && sub.grade !== undefined).length;
        const pendingSubmissions = totalSubmissions - gradedSubmissions;
        const averageGrade = totalSubmissions > 0 ? 
          task.submissions.reduce((sum, sub) => sum + (sub.grade || 0), 0) / totalSubmissions : 0;

        taskObj.submissionStats = {
          totalSubmissions,
          gradedSubmissions,
          pendingSubmissions,
          averageGrade: Math.round(averageGrade * 100) / 100
        };
      } else {
        taskObj.submissionStats = {
          totalSubmissions: 0,
          gradedSubmissions: 0,
          pendingSubmissions: 0,
          averageGrade: 0
        };
      }
      
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

// ✅ CREATE TASK - Modified to accept facultyId in body
router.post('/create', async (req, res) => {
  try {
    const { title, description, serverId, teamId, dueDate, maxPoints, submissionType, facultyId, userRole } = req.body;

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
        message: 'Only faculty can create tasks'
      });
    }

    // Validate required fields
    if (!title || !serverId) {
      return res.status(400).json({
        success: false,
        message: 'Title and server ID are required'
      });
    }

    // Verify server ownership
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Project server not found'
      });
    }

    if (server.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only create tasks for your own servers'
      });
    }

    // If teamId is provided, verify it belongs to the server
    if (teamId) {
      const team = await StudentTeam.findById(teamId);
      if (!team || team.projectServer !== server.code) {
        return res.status(400).json({
          success: false,
          message: 'Team does not belong to the specified server'
        });
      }
    }

    const newTask = new Task({
      title: title.trim(),
      description: description?.trim() || '',
      server: serverId,
      team: teamId || null,
      faculty: facultyId,
      dueDate: dueDate ? new Date(dueDate) : null,
      maxPoints: maxPoints || 100,
      submissionType: submissionType || 'text',
      status: 'active',
      submissions: []
    });

    await newTask.save();

    const populatedTask = await Task.findById(newTask._id)
      .populate('server', 'title code description')
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email');

    logWithTimestamp('info', 'Task created successfully', {
      taskId: newTask._id,
      taskTitle: newTask.title,
      facultyId: facultyId,
      serverId,
      teamId
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: populatedTask
    });

  } catch (error) {
    logWithTimestamp('error', 'Error creating task', {
      error: error.message,
      facultyId: req.body.facultyId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TASK DETAILS
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId, userRole } = req.query;

    const task = await Task.findById(taskId)
      .populate('server', 'title code description')
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Add submission info for student
    let taskWithSubmission = task.toObject();
    
    if (userId && userRole === 'student') {
      // Check for existing submission
      let userSubmission = null;
      
      if (task.submissions && Array.isArray(task.submissions)) {
        userSubmission = task.submissions.find(sub => 
          sub.student && sub.student.toString() === userId
        );
      }
      
      // Check file submissions if available
      if (!userSubmission && hasFileUploadSupport && Submission) {
        try {
          const fileSubmission = await Submission.findOne({
            task: taskId,
            student: userId
          });
          if (fileSubmission) {
            userSubmission = {
              type: 'file',
              status: fileSubmission.status,
              submittedAt: fileSubmission.submittedAt,
              grade: fileSubmission.grade,
              feedback: fileSubmission.feedback,
              files: fileSubmission.files
            };
          }
        } catch (fileErr) {
          logWithTimestamp('warn', 'File submission check failed', { error: fileErr.message });
        }
      }
      
      taskWithSubmission.userSubmission = userSubmission;
      taskWithSubmission.hasUserSubmission = !!userSubmission;
    }

    res.json({
      success: true,
      task: taskWithSubmission
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

// ✅ UPDATE TASK - Modified to accept facultyId in body
router.put('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, dueDate, maxPoints, status, facultyId, userRole } = req.body;

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

    // Verify ownership
    if (task.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own tasks'
      });
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (maxPoints !== undefined) updates.maxPoints = maxPoints;
    if (status !== undefined) updates.status = status;
    updates.updatedAt = new Date();

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      updates,
      { new: true, runValidators: true }
    )
    .populate('server', 'title code description')
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email');

    logWithTimestamp('info', 'Task updated successfully', {
      taskId,
      facultyId: facultyId
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask
    });

  } catch (error) {
    logWithTimestamp('error', 'Error updating task', {
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

// ✅ DELETE TASK - Modified to accept facultyId in body
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

    // Verify ownership
    if (task.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own tasks'
      });
    }

    // Check if task has submissions
    const hasSubmissions = task.submissions && task.submissions.length > 0;
    
    // Also check file submissions if available
    let hasFileSubmissions = false;
    if (hasFileUploadSupport && Submission) {
      try {
        const fileSubmissionCount = await Submission.countDocuments({ task: taskId });
        hasFileSubmissions = fileSubmissionCount > 0;
      } catch (fileErr) {
        logWithTimestamp('warn', 'File submission count check failed', { error: fileErr.message });
      }
    }

    if (hasSubmissions || hasFileSubmissions) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete task with existing submissions. Archive the task instead.',
        hasSubmissions: hasSubmissions,
        hasFileSubmissions: hasFileSubmissions
      });
    }

    await Task.findByIdAndDelete(taskId);

    logWithTimestamp('info', 'Task deleted successfully', {
      taskId,
      taskTitle: task.title,
      facultyId: facultyId
    });

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    logWithTimestamp('error', 'Error deleting task', {
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

// ✅ SUBMIT TASK - Modified to accept studentId in body
router.post('/:taskId/submit', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { content, submissionText, studentId, userRole } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId is required in request body'
      });
    }

    const role = userRole || 'student';
    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit tasks'
      });
    }

    const task = await Task.findById(taskId).populate('team');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if student has access to this task
    if (task.team) {
      const team = await StudentTeam.findById(task.team._id);
      if (!team || !team.members.includes(studentId)) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to submit to this task'
        });
      }
    }

    // Check if task is still accepting submissions
    if (task.status !== 'active' && task.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Task is no longer accepting submissions'
      });
    }

    // Check due date
    if (task.dueDate && new Date() > new Date(task.dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Task submission deadline has passed',
        warning: 'Late submission - contact faculty for approval'
      });
    }

    const submissionContent = content || submissionText;
    if (!submissionContent || submissionContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Submission content is required'
      });
    }

    // Check for existing submission
    const existingSubmissionIndex = task.submissions.findIndex(sub => 
      sub.student && sub.student.toString() === studentId
    );

    const submissionData = {
      student: studentId,
      content: submissionContent.trim(),
      submittedAt: new Date(),
      status: 'submitted',
      attemptNumber: 1,
      isLate: task.dueDate && new Date() > new Date(task.dueDate)
    };

    if (existingSubmissionIndex >= 0) {
      // Update existing submission
      const existingSubmission = task.submissions[existingSubmissionIndex];
      submissionData.attemptNumber = (existingSubmission.attemptNumber || 1) + 1;
      task.submissions[existingSubmissionIndex] = submissionData;
    } else {
      // Add new submission
      task.submissions.push(submissionData);
    }

    await task.save();

    logWithTimestamp('info', 'Task submission successful', {
      taskId,
      studentId: studentId,
      attemptNumber: submissionData.attemptNumber,
      isLate: submissionData.isLate
    });

    res.json({
      success: true,
      message: existingSubmissionIndex >= 0 ? 'Submission updated successfully' : 'Submission created successfully',
      submission: {
        submittedAt: submissionData.submittedAt,
        status: submissionData.status,
        attemptNumber: submissionData.attemptNumber,
        isLate: submissionData.isLate
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Error submitting task', {
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

// ✅ GRADE SUBMISSION - Modified to accept facultyId in body
router.post('/:taskId/grade/:studentId', async (req, res) => {
  try {
    const { taskId, studentId } = req.params;
    const { grade, feedback, facultyId, userRole } = req.body;

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

    // Verify ownership
    if (task.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only grade your own tasks'
      });
    }

    // Find the submission
    const submissionIndex = task.submissions.findIndex(sub => 
      sub.student && sub.student.toString() === studentId
    );

    if (submissionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Validate grade
    if (grade !== null && grade !== undefined) {
      const numericGrade = parseFloat(grade);
      if (isNaN(numericGrade) || numericGrade < 0 || numericGrade > task.maxPoints) {
        return res.status(400).json({
          success: false,
          message: `Grade must be between 0 and ${task.maxPoints}`
        });
      }
    }

    // Update the submission
    task.submissions[submissionIndex].grade = grade;
    task.submissions[submissionIndex].feedback = feedback?.trim() || '';
    task.submissions[submissionIndex].gradedAt = new Date();
    task.submissions[submissionIndex].gradedBy = facultyId;
    task.submissions[submissionIndex].status = 'graded';

    await task.save();

    logWithTimestamp('info', 'Submission graded successfully', {
      taskId,
      studentId,
      grade,
      facultyId: facultyId
    });

    res.json({
      success: true,
      message: 'Submission graded successfully',
      grade: {
        score: grade,
        maxPoints: task.maxPoints,
        feedback: feedback?.trim() || '',
        gradedAt: task.submissions[submissionIndex].gradedAt
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Error grading submission', {
      error: error.message,
      taskId: req.params.taskId,
      studentId: req.params.studentId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to grade submission',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TASK SUBMISSIONS - Modified to accept facultyId as query param
router.get('/:taskId/submissions', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { facultyId } = req.query;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId query parameter is required'
      });
    }

    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate({
        path: 'submissions.student',
        select: 'firstName lastName email username'
      });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Verify ownership
    if (task.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view submissions for your own tasks'
      });
    }

    const submissions = task.submissions || [];
    const totalSubmissions = submissions.length;
    const gradedSubmissions = submissions.filter(sub => sub.grade !== null && sub.grade !== undefined).length;
    const pendingSubmissions = totalSubmissions - gradedSubmissions;

    res.json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        dueDate: task.dueDate,
        maxPoints: task.maxPoints
      },
      submissions: submissions,
      stats: {
        totalSubmissions,
        gradedSubmissions,
        pendingSubmissions,
        submissionRate: task.team && task.team.members ? 
          Math.round((totalSubmissions / task.team.members.length) * 100) : 0
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching submissions', {
      error: error.message,
      taskId: req.params.taskId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;