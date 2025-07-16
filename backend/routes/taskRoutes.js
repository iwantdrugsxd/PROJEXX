const express = require('express');
const router = express.Router();
const Task = require('../models/taskSchema');
const StudentTeam = require('../models/studentTeamSchema');
const Student = require('../models/studentSchema');
const ProjectServer = require('../models/projectServerSchema');
const verifyToken = require('../middleware/verifyToken');
const NotificationService = require('../services/notificationService');

console.log('🔧 taskRoutes.js loaded');

// ✅ Create task - Enhanced for team and individual assignments
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      serverId, 
      teamIds, 
      dueDate, 
      maxPoints,
      assignToAll,
      assignmentType = 'team'
    } = req.body;
    
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can create tasks',
        success: false 
      });
    }

    // Validate inputs
    if (!title || !description || !serverId || !dueDate) {
      return res.status(400).json({ 
        message: 'Title, description, server, and due date are required', 
        success: false 
      });
    }

    if (title.trim().length < 3) {
      return res.status(400).json({ 
        message: 'Task title must be at least 3 characters long', 
        success: false 
      });
    }

    if (description.trim().length < 10) {
      return res.status(400).json({ 
        message: 'Task description must be at least 10 characters long', 
        success: false 
      });
    }

    if (new Date(dueDate) <= new Date()) {
      return res.status(400).json({ 
        message: 'Due date must be in the future', 
        success: false 
      });
    }

    // Get server and verify ownership
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Project server not found',
        success: false 
      });
    }

    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only create tasks in your own servers',
        success: false 
      });
    }

    // Get teams to assign
    let targetTeams = [];
    
    if (assignToAll) {
      // Get all teams in the server
      targetTeams = await StudentTeam.find({ 
        projectServer: server.code 
      }).populate('members');
    } else if (teamIds && teamIds.length > 0) {
      // Get specific teams
      targetTeams = await StudentTeam.find({
        _id: { $in: teamIds },
        projectServer: server.code
      }).populate('members');
      
      if (targetTeams.length !== teamIds.length) {
        return res.status(400).json({ 
          message: 'Some teams were not found or don\'t belong to this server',
          success: false 
        });
      }
    } else {
      return res.status(400).json({ 
        message: 'Please select teams or choose to assign to all teams',
        success: false 
      });
    }

    if (targetTeams.length === 0) {
      return res.status(400).json({ 
        message: 'No teams found to assign the task',
        success: false 
      });
    }

    // Create tasks for each team
    const createdTasks = [];
    
    for (const team of targetTeams) {
      const task = new Task({
        title: title.trim(),
        description: description.trim(),
        server: serverId,
        team: team._id,
        faculty: req.user.id,
        assignmentType: assignmentType,
        dueDate: new Date(dueDate),
        maxPoints: maxPoints || 100,
        status: 'active',
        isVisible: true,
        publishedAt: new Date()
      });
      
      await task.save();
      createdTasks.push(task);
      
      // Send notifications to team members
      if (NotificationService && NotificationService.notifyTaskAssigned) {
        await NotificationService.notifyTaskAssigned(task, team, server);
      }
    }

    console.log(`✅ Created ${createdTasks.length} tasks for faculty ${req.user.id}`);
    
    res.status(201).json({ 
      success: true, 
      message: `Task created and assigned to ${createdTasks.length} team(s)`,
      tasks: createdTasks,
      teamsAssigned: targetTeams.length
    });

  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to create task',
      success: false 
    });
  }
});

// ✅ Get teams for a specific server (for task creation) - NO server membership check
router.get('/server/:serverId/teams', verifyToken, async (req, res) => {
  console.log('🎯 GET TEAMS FOR SERVER route hit');
  console.log('Server ID:', req.params.serverId);
  console.log('User:', req.user);

  try {
    const { serverId } = req.params;
    
    // Verify user has access to this server
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    // Check if faculty owns the server
    if (req.user.role === 'faculty' && server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only access teams from your own servers',
        success: false 
      });
    }

    // ✅ REMOVED: Server membership check for students
    // Students can now access teams without server membership

    // Get teams for this server using the server code
    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    })
    .select('name _id members')
    .populate('members', 'firstName lastName email')
    .sort({ createdAt: -1 });

    console.log(`✅ Found ${teams.length} teams for server ${server.title}`);
    
    res.json({ 
      success: true, 
      teams,
      server: {
        id: server._id,
        title: server.title,
        code: server.code
      }
    });
  } catch (error) {
    console.error('❌ Get teams for server error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch teams',
      success: false 
    });
  }
});

// ✅ Get tasks for a specific server
router.get('/server/:serverId', verifyToken, async (req, res) => {
  console.log('🎯 GET TASKS FOR SERVER route hit');
  console.log('Server ID:', req.params.serverId);
  console.log('User:', req.user);

  try {
    const { serverId } = req.params;
    
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    // Verify access based on role
    if (req.user.role === 'faculty') {
      // Faculty can only see tasks in their own servers
      if (server.faculty.toString() !== req.user.id) {
        return res.status(403).json({ 
          message: 'You can only access tasks from your own servers',
          success: false 
        });
      }
    }

    // Get tasks for this server
    const tasks = await Task.find({ 
      server: serverId,
      status: 'active'
    })
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email')
    .populate('server', 'title code')
    .sort({ createdAt: -1 });

    // Add submission status for students
    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      
      if (req.user.role === 'student') {
        const submission = task.submissions.find(sub => 
          sub.student.toString() === req.user.id
        );
        taskObj.submissionStatus = submission ? submission.status : 'pending';
        taskObj.submissionDate = submission ? submission.submittedAt : null;
        taskObj.grade = submission ? submission.grade : null;
        taskObj.feedback = submission ? submission.feedback : null;
      }
      
      return taskObj;
    });

    console.log(`✅ Found ${tasks.length} tasks for server ${serverId}`);
    res.json({ success: true, tasks: tasksWithStatus });
  } catch (error) {
    console.error('❌ Get tasks error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch tasks',
      success: false 
    });
  }
});

// ✅ Get tasks for faculty (all tasks in their servers)
router.get('/faculty-tasks', verifyToken, async (req, res) => {
  console.log('🎯 GET FACULTY TASKS route hit');
  console.log('User:', req.user);

  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Access denied. Faculty access required.',
        success: false 
      });
    }

    // Get all tasks created by this faculty
    const tasks = await Task.find({ faculty: req.user.id })
      .populate('server', 'title code')
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Add submission statistics for each task
    const tasksWithStats = tasks.map(task => {
      const taskObj = task.toObject();
      taskObj.totalSubmissions = task.submissions.length;
      taskObj.pendingSubmissions = task.submissions.filter(s => s.status === 'submitted').length;
      taskObj.gradedSubmissions = task.submissions.filter(s => s.status === 'graded').length;
      return taskObj;
    });

    console.log(`✅ Found ${tasks.length} tasks for faculty ${req.user.id}`);
    res.json({ 
      success: true, 
      tasks: tasksWithStats,
      message: tasks.length === 0 ? 'No tasks created yet' : `Found ${tasks.length} tasks`
    });
  } catch (error) {
    console.error('❌ Get faculty tasks error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch tasks',
      success: false 
    });
  }
});

// ✅ Get tasks for student (based on team membership only)
router.get('/student-tasks', verifyToken, async (req, res) => {
  console.log('🎯 GET STUDENT TASKS route hit');
  console.log('User:', req.user);

  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Access denied. Student access required.',
        success: false 
      });
    }

    // ✅ UPDATED: Find tasks based on team membership only, not server membership
    // Get all teams the student is a member of
    const studentTeams = await StudentTeam.find({ 
      members: req.user.id 
    }).select('_id');

    const teamIds = studentTeams.map(team => team._id);

    if (teamIds.length === 0) {
      return res.json({ 
        success: true, 
        tasks: [],
        message: 'No tasks found. Create or join a team to see assigned tasks.',
        info: 'Tasks are assigned to teams, not individual server members'
      });
    }

    // Find tasks assigned to student's teams
    const tasks = await Task.find({ 
      team: { $in: teamIds },
      status: 'active'
    })
    .populate('server', 'title code')
    .populate('team', 'name members')
    .populate('faculty', 'firstName lastName email')
    .sort({ createdAt: -1 });

    // Add submission status for each task
    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      const submission = task.submissions.find(sub => 
        sub.student.toString() === req.user.id
      );
      
      taskObj.submissionStatus = submission ? submission.status : 'pending';
      taskObj.submissionDate = submission ? submission.submittedAt : null;
      taskObj.grade = submission ? submission.grade : null;
      taskObj.feedback = submission ? submission.feedback : null;
      
      return taskObj;
    });

    console.log(`✅ Found ${tasks.length} tasks for student ${req.user.id} based on team membership`);
    res.json({ 
      success: true, 
      tasks: tasksWithStatus,
      teamsCount: teamIds.length,
      message: tasks.length === 0 ? 'No tasks assigned to your teams yet' : `Found ${tasks.length} tasks`
    });
  } catch (error) {
    console.error('❌ Get student tasks error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch tasks',
      success: false 
    });
  }
});

// ✅ Submit task
router.post('/:taskId/submit', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Only students can submit tasks',
        success: false 
      });
    }

    const { taskId } = req.params;
    const { comment, collaborators = [] } = req.body;

    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code');

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // ✅ UPDATED: Check if student is part of the assigned team (not server membership)
    const isTeamMember = task.team.members.some(member => 
      member.toString() === req.user.id
    );

    if (!isTeamMember) {
      return res.status(403).json({ 
        message: 'You can only submit tasks assigned to your teams',
        success: false 
      });
    }

    // Check if task is still active and not overdue
    if (task.status !== 'active') {
      return res.status(400).json({ 
        message: 'Task is not active',
        success: false 
      });
    }

    if (new Date() > task.dueDate && !task.allowLateSubmissions) {
      return res.status(400).json({ 
        message: 'Task submission deadline has passed',
        success: false 
      });
    }

    // Check if student has already submitted
    const existingSubmission = task.submissions.find(sub => 
      sub.student.toString() === req.user.id
    );

    if (existingSubmission && task.maxAttempts === 1) {
      return res.status(400).json({ 
        message: 'You have already submitted this task',
        success: false 
      });
    }

    // Check attempt limit
    const studentSubmissions = task.submissions.filter(sub => 
      sub.student.toString() === req.user.id
    );

    if (studentSubmissions.length >= task.maxAttempts) {
      return res.status(400).json({ 
        message: `Maximum attempts (${task.maxAttempts}) reached`,
        success: false 
      });
    }

    // Create submission
    const submission = {
      student: req.user.id,
      comment: comment || '',
      submittedAt: new Date(),
      status: 'submitted',
      isLate: new Date() > task.dueDate,
      attemptNumber: studentSubmissions.length + 1,
      collaborators: collaborators
    };

    task.submissions.push(submission);
    await task.save();

    // Notify faculty
    if (NotificationService && NotificationService.notifyTaskSubmitted) {
      await NotificationService.notifyTaskSubmitted(task, submission, req.user);
    }

    console.log(`✅ Task ${taskId} submitted by student ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Task submitted successfully',
      submission: submission
    });

  } catch (error) {
    console.error('❌ Submit task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to submit task',
      success: false 
    });
  }
});

// ✅ Grade task submission
router.post('/:taskId/grade/:studentId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can grade tasks',
        success: false 
      });
    }

    const { taskId, studentId } = req.params;
    const { grade, feedback } = req.body;

    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code');

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns the task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only grade your own tasks',
        success: false 
      });
    }

    // Validate grade
    if (grade < 0 || grade > task.maxPoints) {
      return res.status(400).json({ 
        message: `Grade must be between 0 and ${task.maxPoints}`,
        success: false 
      });
    }

    // Find submission
    const submission = task.submissions.find(sub => 
      sub.student.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({ 
        message: 'Submission not found',
        success: false 
      });
    }

    // Update submission
    submission.grade = grade;
    submission.feedback = feedback || '';
    submission.status = 'graded';
    submission.gradedAt = new Date();
    submission.gradedBy = req.user.id;

    await task.save();

    // Notify student
    if (NotificationService && NotificationService.notifyTaskGraded) {
      await NotificationService.notifyTaskGraded(task, submission, req.user);
    }

    console.log(`✅ Task ${taskId} graded for student ${studentId} by faculty ${req.user.id}`);

    res.json({
      success: true,
      message: 'Task graded successfully',
      submission: submission
    });

  } catch (error) {
    console.error('❌ Grade task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to grade task',
      success: false 
    });
  }
});

// ✅ Get task submissions
router.get('/:taskId/submissions', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .populate('team', 'name members')
      .populate('server', 'title code')
      .populate('submissions.student', 'firstName lastName email')
      .populate('submissions.gradedBy', 'firstName lastName email');

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Check permissions
    if (req.user.role === 'faculty') {
      // Faculty can see all submissions for their tasks
      if (task.faculty.toString() !== req.user.id) {
        return res.status(403).json({ 
          message: 'You can only view submissions for your own tasks',
          success: false 
        });
      }
    } else {
      // Students can only see their own submissions
      const isTeamMember = task.team.members.some(member => 
        member.toString() === req.user.id
      );

      if (!isTeamMember) {
        return res.status(403).json({ 
          message: 'You can only view submissions for tasks assigned to your teams',
          success: false 
        });
      }
    }

    let submissions = task.submissions;

    // Filter submissions for students (only their own)
    if (req.user.role === 'student') {
      submissions = submissions.filter(sub => 
        sub.student._id.toString() === req.user.id
      );
    }

    console.log(`✅ Retrieved ${submissions.length} submissions for task ${taskId}`);

    res.json({
      success: true,
      submissions,
      task: {
        id: task._id,
        title: task.title,
        maxPoints: task.maxPoints,
        dueDate: task.dueDate
      }
    });

  } catch (error) {
    console.error('❌ Get submissions error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch submissions',
      success: false 
    });
  }
});

// ✅ Update task
router.put('/:taskId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can update tasks',
        success: false 
      });
    }

    const { taskId } = req.params;
    const updates = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns the task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only update your own tasks',
        success: false 
      });
    }

    // Validate updates
    if (updates.dueDate && new Date(updates.dueDate) <= new Date()) {
      return res.status(400).json({ 
        message: 'Due date must be in the future',
        success: false 
      });
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'description', 'dueDate', 'maxPoints', 'status', 'priority', 'allowLateSubmissions', 'maxAttempts'];
    const updateData = {};

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    updateData.updatedAt = new Date();

    const updatedTask = await Task.findByIdAndUpdate(
      taskId, 
      updateData, 
      { new: true, runValidators: true }
    )
    .populate('team', 'name members')
    .populate('server', 'title code')
    .populate('faculty', 'firstName lastName email');

    console.log(`✅ Task ${taskId} updated by faculty ${req.user.id}`);

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask
    });

  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to update task',
      success: false 
    });
  }
});

// ✅ Delete task
router.delete('/:taskId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can delete tasks',
        success: false 
      });
    }

    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns the task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only delete your own tasks',
        success: false 
      });
    }

    await Task.findByIdAndDelete(taskId);

    console.log(`✅ Task ${taskId} deleted by faculty ${req.user.id}`);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to delete task',
      success: false 
    });
  }
});

module.exports = router;