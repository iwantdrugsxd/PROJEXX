const express = require('express');
const router = express.Router();
const Task = require('../models/taskSchema');
const ProjectServer = require('../models/projectServerSchema');
const StudentTeam = require('../models/studentTeamSchema');
const Student = require('../models/studentSchema');
const Faculty = require('../models/facultySchema');
const verifyToken = require('../middleware/verifyToken');
const multer = require('multer');
const path = require('path');

console.log('🔧 taskRoutes.js loaded');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// ✅ Enhanced Task Creation with Team and Server Validation
router.post('/create', verifyToken, async (req, res) => {
  console.log('🎯 CREATE TASK route hit');
  console.log('User:', req.user);
  console.log('Request body:', req.body);

  try {
    const { title, description, serverId, teamId, dueDate, maxPoints } = req.body;
    
    // Enhanced input validation
    if (!title || !description || !serverId || !dueDate || !teamId) {
      return res.status(400).json({ 
        message: 'All fields (title, description, serverId, teamId, dueDate) are required', 
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

    // Check if due date is in the future
    if (new Date(dueDate) <= new Date()) {
      return res.status(400).json({ 
        message: 'Due date must be in the future', 
        success: false 
      });
    }
    
    // Check if user is faculty
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can create tasks',
        success: false 
      });
    }
    
    // Verify faculty owns the server
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Project server not found',
        success: false 
      });
    }

    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only create tasks for your own servers',
        success: false 
      });
    }

    // Validate that the team exists and belongs to the server
    const team = await StudentTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ 
        message: 'Team not found', 
        success: false 
      });
    }

    // Check if team belongs to the server (by comparing server codes)
    if (team.projectServer !== server.code) {
      return res.status(400).json({ 
        message: 'Selected team does not belong to this server', 
        success: false 
      });
    }

    // Create the task
    const task = new Task({
      title: title.trim(),
      description: description.trim(),
      server: serverId,
      team: teamId,
      faculty: req.user.id,
      dueDate: new Date(dueDate),
      maxPoints: parseInt(maxPoints) || 100,
      createdAt: new Date()
    });

    await task.save();
    
    // Populate the task with related data
    await task.populate('server', 'title code');
    await task.populate('team', 'name members');
    await task.populate('faculty', 'firstName lastName email');
    await NotificationService.notifyTaskAssigned(newTask, team, server);
    console.log('✅ Task created successfully:', task.title);
    
    res.status(201).json({ 
      success: true, 
      task,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to create task',
      success: false 
    });
  }
});

// ✅ Get teams for a specific server (for task creation)
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
  console.log('User:', req.user);
  console.log('Server ID:', req.params.serverId);

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

    const isFaculty = req.user.role === 'faculty' && server.faculty.toString() === req.user.id;
    const isStudent = req.user.role === 'student' && server.students.includes(req.user.id);
    
    if (!isFaculty && !isStudent) {
      return res.status(403).json({ 
        message: 'You do not have access to this server',
        success: false 
      });
    }

    // Get tasks for this server
    let tasks = await Task.find({ server: serverId })
      .populate('faculty', 'firstName lastName email')
      .populate('server', 'title code')
      .populate('team', 'name members')
      .sort({ createdAt: -1 });

    // Filter tasks for students - only show tasks assigned to their teams
    if (!isFaculty && req.user.role === 'student') {
      // Get student's teams in this server
      const studentTeams = await StudentTeam.find({ 
        members: req.user.id,
        projectServer: server.code
      }).select('_id');
      
      const studentTeamIds = studentTeams.map(team => team._id.toString());
      
      // Filter tasks to only those assigned to student's teams
      tasks = tasks.filter(task => 
        task.team && studentTeamIds.includes(task.team._id.toString())
      );
    }

    // Add submission status for students
    const tasksWithStatus = await Promise.all(tasks.map(async (task) => {
      const taskObj = task.toObject();
      
      if (!isFaculty && req.user.role === 'student') {
        const submission = task.submissions.find(s => s.student.toString() === req.user.id);
        taskObj.submissionStatus = submission ? submission.status : 'pending';
        taskObj.submissionDate = submission ? submission.submittedAt : null;
        taskObj.grade = submission ? submission.grade : null;
        taskObj.feedback = submission ? submission.feedback : null;
      }
      
      return taskObj;
    }));

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
      taskObj.pendingSubmissions = task.submissions.filter(s => s.status === 'pending').length;
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

// ✅ Get tasks for student (tasks assigned to their teams)
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

    // Get all teams the student is a member of
    const studentTeams = await StudentTeam.find({ 
      members: req.user.id 
    }).select('_id');
    
    const teamIds = studentTeams.map(team => team._id);

    // Get tasks assigned to those teams
    const tasks = await Task.find({ team: { $in: teamIds } })
      .populate('server', 'title code')
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Add submission status for each task
    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      const submission = task.submissions.find(s => s.student.toString() === req.user.id);
      
      taskObj.submissionStatus = submission ? submission.status : 'pending';
      taskObj.submissionDate = submission ? submission.submittedAt : null;
      taskObj.grade = submission ? submission.grade : null;
      taskObj.feedback = submission ? submission.feedback : null;
      taskObj.isOverdue = new Date() > new Date(task.dueDate);
      
      return taskObj;
    });

    console.log(`✅ Found ${tasks.length} tasks for student ${req.user.id}`);
    res.json({ 
      success: true, 
      tasks: tasksWithStatus,
      message: tasks.length === 0 ? 'No tasks assigned yet' : `Found ${tasks.length} tasks`
    });
  } catch (error) {
    console.error('❌ Get student tasks error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch tasks',
      success: false 
    });
  }
});

// ✅ Submit task (Students only)
router.post('/:taskId/submit', verifyToken, upload.single('file'), async (req, res) => {
  console.log('🎯 SUBMIT TASK route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);
  console.log('File:', req.file);

  try {
    const { taskId } = req.params;
    const { comment } = req.body;
    
    // Check if user is student
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Only students can submit tasks',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId)
      .populate('server', 'students')
      .populate('team', 'members');
      
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify student is part of the assigned team
    if (!task.team.members.some(member => member.toString() === req.user.id)) {
      return res.status(403).json({ 
        message: 'You are not a member of the team assigned to this task',
        success: false 
      });
    }

    // Check if already submitted
    const existingSubmission = task.submissions.find(s => s.student.toString() === req.user.id);
    if (existingSubmission) {
      return res.status(400).json({ 
        message: 'You have already submitted this task',
        success: false 
      });
    }

    // Check deadline
    if (new Date() > task.dueDate) {
      return res.status(400).json({ 
        message: 'Task deadline has passed',
        success: false 
      });
    }

    // Create submission object
    const submission = {
      student: req.user.id,
      submittedAt: new Date(),
      status: 'submitted',
      comment: comment || '',
      file: req.file ? {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size
      } : null
    };

    // Add submission to task
    task.submissions.push(submission);
    await task.save();
    const student = await Student.findById(req.user.id);
await NotificationService.notifyTaskSubmitted(task, submission, student);

    console.log('✅ Task submitted successfully by student:', req.user.id);
    res.json({ 
      success: true, 
      message: 'Task submitted successfully',
      submission: {
        submittedAt: submission.submittedAt,
        status: submission.status,
        comment: submission.comment,
        hasFile: !!submission.file
      }
    });
  } catch (error) {
    console.error('❌ Submit task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to submit task',
      success: false 
    });
  }
});

// ✅ Grade task submission (Faculty only)
router.post('/:taskId/grade/:studentId', verifyToken, async (req, res) => {
  console.log('🎯 GRADE TASK route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);
  console.log('Student ID:', req.params.studentId);

  try {
    const { taskId, studentId } = req.params;
    const { grade, feedback } = req.body;
    
    // Check if user is faculty
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can grade tasks',
        success: false 
      });
    }

    // Validate grade
    if (grade === undefined || grade === null || grade < 0) {
      return res.status(400).json({ 
        message: 'Valid grade is required',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns this task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only grade your own tasks',
        success: false 
      });
    }

    // Check if grade exceeds max points
    if (parseInt(grade) > task.maxPoints) {
      return res.status(400).json({ 
        message: `Grade cannot exceed maximum points (${task.maxPoints})`,
        success: false 
      });
    }

    // Find the submission
    const submissionIndex = task.submissions.findIndex(s => s.student.toString() === studentId);
    if (submissionIndex === -1) {
      return res.status(404).json({ 
        message: 'Submission not found',
        success: false 
      });
    }
const student = await Student.findById(studentId);
await NotificationService.notifyTaskVerified(task, student, grade, feedback);
    // Update submission with grade and feedback
    task.submissions[submissionIndex].grade = parseInt(grade);
    task.submissions[submissionIndex].feedback = feedback || '';
    task.submissions[submissionIndex].status = 'graded';
    task.submissions[submissionIndex].gradedAt = new Date();

    await task.save();

    console.log('✅ Task graded successfully');
    res.json({ 
      success: true, 
      message: 'Task graded successfully',
      grade: parseInt(grade),
      feedback: feedback || ''
    });
  } catch (error) {
    console.error('❌ Grade task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to grade task',
      success: false 
    });
  }
});

// ✅ Get task details with submissions (Faculty only)
router.get('/:taskId/submissions', verifyToken, async (req, res) => {
  console.log('🎯 GET TASK SUBMISSIONS route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);

  try {
    const { taskId } = req.params;
    
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can view submissions',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId)
      .populate('server', 'title code')
      .populate('team', 'name members')
      .populate('faculty', 'firstName lastName email')
      .populate('submissions.student', 'firstName lastName email');
      
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns this task
    if (task.faculty._id.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only view submissions for your own tasks',
        success: false 
      });
    }

    console.log(`✅ Found task with ${task.submissions.length} submissions`);
    res.json({ 
      success: true, 
      task,
      submissions: task.submissions
    });
  } catch (error) {
    console.error('❌ Get task submissions error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch submissions',
      success: false 
    });
  }
});

// ✅ Update task (Faculty only)
router.put('/:taskId', verifyToken, async (req, res) => {
  console.log('🎯 UPDATE TASK route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);

  try {
    const { taskId } = req.params;
    const { title, description, dueDate, maxPoints } = req.body;
    
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can update tasks',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns this task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only update your own tasks',
        success: false 
      });
    }

    // Update fields if provided
    if (title) task.title = title.trim();
    if (description) task.description = description.trim();
    if (dueDate) {
      const newDueDate = new Date(dueDate);
      if (newDueDate <= new Date()) {
        return res.status(400).json({ 
          message: 'Due date must be in the future',
          success: false 
        });
      }
      task.dueDate = newDueDate;
    }
    if (maxPoints) task.maxPoints = parseInt(maxPoints);

    task.updatedAt = new Date();
    await task.save();

    // Populate the updated task
    await task.populate('server', 'title code');
    await task.populate('team', 'name members');
    await task.populate('faculty', 'firstName lastName email');

    console.log('✅ Task updated successfully');
    res.json({ 
      success: true, 
      task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to update task',
      success: false 
    });
  }
});

// ✅ Delete task (Faculty only)
router.delete('/:taskId', verifyToken, async (req, res) => {
  console.log('🎯 DELETE TASK route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);

  try {
    const { taskId } = req.params;
    
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ 
        message: 'Only faculty can delete tasks',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify faculty owns this task
    if (task.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only delete your own tasks',
        success: false 
      });
    }

    await Task.findByIdAndDelete(taskId);

    console.log('✅ Task deleted successfully');
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

// ✅ Download submission file
router.get('/submission/:taskId/:studentId/download', verifyToken, async (req, res) => {
  console.log('🎯 DOWNLOAD SUBMISSION route hit');
  console.log('User:', req.user);
  console.log('Task ID:', req.params.taskId);
  console.log('Student ID:', req.params.studentId);

  try {
    const { taskId, studentId } = req.params;
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Check permissions
    const isFaculty = req.user.role === 'faculty' && task.faculty.toString() === req.user.id;
    const isStudent = req.user.role === 'student' && req.user.id === studentId;
    
    if (!isFaculty && !isStudent) {
      return res.status(403).json({ 
        message: 'You do not have permission to download this file',
        success: false 
      });
    }

    // Find the submission
    const submission = task.submissions.find(s => s.student.toString() === studentId);
    if (!submission || !submission.file) {
      return res.status(404).json({ 
        message: 'File not found',
        success: false 
      });
    }

    const filePath = path.join(__dirname, '..', submission.file.path);
    res.download(filePath, submission.file.originalName);
  } catch (error) {
    console.error('❌ Download file error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to download file',
      success: false 
    });
  }
});
router.post('/create-enhanced', verifyToken, async (req, res) => {
  console.log('🎯 ENHANCED CREATE TASK route hit');
  console.log('Request body:', req.body);
  console.log('User:', req.user);

  try {
    const {
      title,
      description,
      serverId,
      teamIds = [],
      assignmentType,
      dueDate,
      maxPoints = 100
    } = req.body;

    // Validation
    if (!title?.trim()) {
      return res.status(400).json({
        message: 'Task title is required',
        success: false
      });
    }

    if (!description?.trim()) {
      return res.status(400).json({
        message: 'Task description is required',
        success: false
      });
    }

    if (!serverId) {
      return res.status(400).json({
        message: 'Server ID is required',
        success: false
      });
    }

    if (!assignmentType || !['teams', 'individuals'].includes(assignmentType)) {
      return res.status(400).json({
        message: 'Valid assignment type is required (teams or individuals)',
        success: false
      });
    }

    if (assignmentType === 'teams' && (!teamIds || teamIds.length === 0)) {
      return res.status(400).json({
        message: 'At least one team must be selected for team assignment',
        success: false
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        message: 'Due date is required',
        success: false
      });
    }

    // Verify user is faculty
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        message: 'Only faculty can create tasks',
        success: false
      });
    }

    // Verify server exists and faculty owns it
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        message: 'Project server not found',
        success: false
      });
    }

    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'You can only create tasks for your own servers',
        success: false
      });
    }

    const createdTasks = [];

    if (assignmentType === 'teams') {
      // Create tasks for selected teams
      for (const teamId of teamIds) {
        // Verify team exists and belongs to this server
        const team = await StudentTeam.findById(teamId);
        if (!team) {
          console.warn(`Team ${teamId} not found, skipping`);
          continue;
        }

        if (team.projectServer !== server.code) {
          console.warn(`Team ${teamId} does not belong to server ${server.code}, skipping`);
          continue;
        }

        // Create individual task for this team
        const task = new Task({
          title: title.trim(),
          description: description.trim(),
          server: serverId,
          team: teamId,
          faculty: req.user.id,
          dueDate: new Date(dueDate),
          maxPoints: parseInt(maxPoints) || 100,
          assignmentType: 'team',
          createdAt: new Date()
        });

        await task.save();
        
        // Populate the task with related data
        await task.populate('server', 'title code');
        await task.populate('team', 'name members');
        await task.populate('faculty', 'firstName lastName email');
        
        createdTasks.push(task);
        console.log(`✅ Task created for team: ${team.name}`);
      }

      res.status(201).json({
        success: true,
        tasks: createdTasks,
        message: `Successfully created ${createdTasks.length} task(s) for selected teams`
      });

    } else if (assignmentType === 'individuals') {
      // Get all students in this server
      const students = await Student.find({
        joinedServers: serverId
      });

      if (students.length === 0) {
        return res.status(400).json({
          message: 'No students found in this server',
          success: false
        });
      }

      // Create individual tasks for each student
      for (const student of students) {
        const task = new Task({
          title: title.trim(),
          description: description.trim(),
          server: serverId,
          student: student._id, // Assign to individual student
          faculty: req.user.id,
          dueDate: new Date(dueDate),
          maxPoints: parseInt(maxPoints) || 100,
          assignmentType: 'individual',
          createdAt: new Date()
        });

        await task.save();
        
        // Populate the task with related data
        await task.populate('server', 'title code');
        await task.populate('student', 'firstName lastName email');
        await task.populate('faculty', 'firstName lastName email');
        
        createdTasks.push(task);
      }

      console.log(`✅ Created ${createdTasks.length} individual tasks`);

      res.status(201).json({
        success: true,
        tasks: createdTasks,
        message: `Successfully created ${createdTasks.length} individual assignment(s)`
      });
    }

  } catch (error) {
    console.error('❌ Enhanced create task error:', error);
    res.status(500).json({
      message: error.message || 'Failed to create task',
      success: false
    });
  }
});

// ✅ Get students in a server (for individual assignments)
router.get('/server/:serverId/students', verifyToken, async (req, res) => {
  console.log('🎯 GET STUDENTS FOR SERVER route hit');
  console.log('Server ID:', req.params.serverId);

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
        message: 'You can only access students from your own servers',
        success: false 
      });
    }

    // Get students who have joined this server
    const students = await Student.find({ 
      joinedServers: serverId 
    })
    .select('firstName lastName email _id')
    .sort({ firstName: 1, lastName: 1 });

    console.log(`✅ Found ${students.length} students in server ${server.title}`);
    
    res.json({ 
      success: true, 
      students,
      server: {
        id: server._id,
        title: server.title,
        code: server.code
      },
      message: students.length === 0 ? 'No students found in this server' : `Found ${students.length} students`
    });
  } catch (error) {
    console.error('❌ Get students for server error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch students',
      success: false 
    });
  }
});

// ✅ Updated task schema to support both team and individual assignments
// Add this to your Task model (models/Task.js)
/*
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectServer',
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentTeam',
    required: false // Optional for individual assignments
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student', 
    required: false // For individual assignments
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  maxPoints: {
    type: Number,
    default: 100,
    min: 1,
    max: 1000
  },
  assignmentType: {
    type: String,
    enum: ['team', 'individual'],
    required: true,
    default: 'team'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure either team or student is provided, but not both
taskSchema.pre('save', function(next) {
  if (this.assignmentType === 'team' && !this.team) {
    return next(new Error('Team is required for team assignments'));
  }
  if (this.assignmentType === 'individual' && !this.student) {
    return next(new Error('Student is required for individual assignments'));
  }
  if (this.team && this.student) {
    return next(new Error('Task cannot be assigned to both team and individual student'));
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
*/

// ✅ Get tasks with enhanced filtering for both team and individual assignments
router.get('/faculty-tasks-enhanced', verifyToken, async (req, res) => {
  console.log('🎯 GET ENHANCED FACULTY TASKS route hit');
  
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        message: 'Faculty access required',
        success: false
      });
    }

    const { serverId, assignmentType } = req.query;
    
    let query = { faculty: req.user.id };
    
    if (serverId) {
      query.server = serverId;
    }
    
    if (assignmentType && ['team', 'individual'].includes(assignmentType)) {
      query.assignmentType = assignmentType;
    }

    const tasks = await Task.find(query)
      .populate('server', 'title code')
      .populate('team', 'name members')
      .populate('student', 'firstName lastName email')
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Group tasks by assignment type for better organization
    const groupedTasks = {
      team: tasks.filter(t => t.assignmentType === 'team'),
      individual: tasks.filter(t => t.assignmentType === 'individual'),
      total: tasks.length
    };

    console.log(`✅ Found ${tasks.length} tasks for faculty ${req.user.id}`);
    
    res.json({
      success: true,
      tasks,
      groupedTasks,
      message: tasks.length === 0 ? 'No tasks found' : `Found ${tasks.length} tasks`
    });
  } catch (error) {
    console.error('❌ Get enhanced faculty tasks error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch tasks',
      success: false
    });
  }
});

// ✅ Get tasks for students (supports both team and individual assignments)
router.get('/student-tasks-enhanced', verifyToken, async (req, res) => {
  console.log('🎯 GET ENHANCED STUDENT TASKS route hit');
  
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        message: 'Student access required',
        success: false
      });
    }

    // Get student's teams
    const studentTeams = await StudentTeam.find({ 
      members: req.user.id 
    }).select('_id');
    
    const teamIds = studentTeams.map(team => team._id);

    // Find tasks assigned to student's teams OR directly to the student
    const tasks = await Task.find({
      $or: [
        { team: { $in: teamIds }, assignmentType: 'team' },
        { student: req.user.id, assignmentType: 'individual' }
      ]
    })
    .populate('server', 'title code')
    .populate('team', 'name members')
    .populate('student', 'firstName lastName email')
    .populate('faculty', 'firstName lastName email')
    .sort({ dueDate: 1 });

    // Group tasks by assignment type
    const groupedTasks = {
      team: tasks.filter(t => t.assignmentType === 'team'),
      individual: tasks.filter(t => t.assignmentType === 'individual'),
      total: tasks.length
    };

    console.log(`✅ Found ${tasks.length} tasks for student ${req.user.id}`);
    
    res.json({
      success: true,
      tasks,
      groupedTasks,
      message: tasks.length === 0 ? 'No tasks assigned to you' : `Found ${tasks.length} tasks`
    });
  } catch (error) {
    console.error('❌ Get enhanced student tasks error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch tasks',
      success: false
    });
  }
});

// ✅ Get server overview with teams and students count
router.get('/server/:serverId/overview', verifyToken, async (req, res) => {
  console.log('🎯 GET SERVER OVERVIEW route hit');
  
  try {
    const { serverId } = req.params;
    
    // Verify server exists and user has access
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        message: 'Server not found',
        success: false
      });
    }

    if (req.user.role === 'faculty' && server.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Access denied',
        success: false
      });
    }

    // Get teams count
    const teamsCount = await StudentTeam.countDocuments({ 
      projectServer: server.code 
    });

    // Get students count
    const studentsCount = await Student.countDocuments({ 
      joinedServers: serverId 
    });

    // Get tasks count
    const tasksCount = await Task.countDocuments({ 
      server: serverId 
    });

    // Get recent teams
    const recentTeams = await StudentTeam.find({ 
      projectServer: server.code 
    })
    .populate('members', 'firstName lastName email')
    .populate('creator', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(5);

    // Get recent students
    const recentStudents = await Student.find({ 
      joinedServers: serverId 
    })
    .select('firstName lastName email createdAt')
    .sort({ createdAt: -1 })
    .limit(10);

    console.log(`✅ Server overview: ${teamsCount} teams, ${studentsCount} students, ${tasksCount} tasks`);
    
    res.json({
      success: true,
      server: {
        id: server._id,
        title: server.title,
        code: server.code,
        description: server.description
      },
      stats: {
        teams: teamsCount,
        students: studentsCount,
        tasks: tasksCount
      },
      recentTeams,
      recentStudents,
      recommendations: {
        canCreateTeamTasks: teamsCount > 0,
        canCreateIndividualTasks: studentsCount > 0,
        shouldEncourageTeamCreation: teamsCount === 0 && studentsCount > 0
      }
    });
  } catch (error) {
    console.error('❌ Get server overview error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch server overview',
      success: false
    });
  }
}); 
// Add this debugging route to your taskRoutes.js to diagnose the issue

// 🔍 DEBUG: Check team-server connection
router.get('/debug/server/:serverId/teams-analysis', verifyToken, async (req, res) => {
  console.log('🔍 DEBUG: TEAMS ANALYSIS route hit');
  
  try {
    const { serverId } = req.params;
    
    // Get the project server
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    console.log('🔍 Server found:', server.title, 'Code:', server.code);

    // Get ALL teams in database (for comparison)
    const allTeams = await StudentTeam.find({})
      .select('name projectServer members')
      .populate('members', 'firstName lastName email');
    
    // Get teams that should match this server
    const matchingTeams = await StudentTeam.find({ 
      projectServer: server.code 
    })
    .select('name projectServer members')
    .populate('members', 'firstName lastName email');

    // Get teams with similar server codes (case-insensitive)
    const similarTeams = await StudentTeam.find({ 
      projectServer: { $regex: new RegExp(server.code, 'i') }
    })
    .select('name projectServer members')
    .populate('members', 'firstName lastName email');

    // Check for teams with trimming issues
    const trimmedCodeTeams = allTeams.filter(team => 
      team.projectServer.trim().toLowerCase() === server.code.trim().toLowerCase()
    );

    // Get students in this server
    const studentsInServer = await Student.find({ 
      joinedServers: serverId 
    }).select('firstName lastName email');

    // Check if any teams have members from this server
    const teamsWithServerMembers = allTeams.filter(team => {
      return team.members.some(member => 
        studentsInServer.some(student => student._id.toString() === member._id.toString())
      );
    });

    const analysis = {
      server: {
        id: server._id,
        title: server.title,
        code: server.code,
        codeLength: server.code.length,
        hasSpaces: server.code.includes(' '),
        hasSpecialChars: /[^a-zA-Z0-9]/.test(server.code)
      },
      teams: {
        total: allTeams.length,
        exactMatches: matchingTeams.length,
        similarMatches: similarTeams.length,
        trimmedMatches: trimmedCodeTeams.length,
        withServerMembers: teamsWithServerMembers.length
      },
      students: {
        inServer: studentsInServer.length
      },
      teamDetails: {
        allTeams: allTeams.map(team => ({
          name: team.name,
          projectServer: team.projectServer,
          projectServerLength: team.projectServer.length,
          members: team.members.length,
          exactMatch: team.projectServer === server.code,
          caseInsensitiveMatch: team.projectServer.toLowerCase() === server.code.toLowerCase(),
          trimmedMatch: team.projectServer.trim() === server.code.trim()
        })),
        exactMatches: matchingTeams,
        similarMatches: similarTeams,
        trimmedMatches: trimmedCodeTeams,
        teamsWithServerMembers
      },
      diagnostics: {
        serverCodeTrimmed: server.code.trim(),
        serverCodeUpperCase: server.code.toUpperCase(),
        serverCodeLowerCase: server.code.toLowerCase(),
        possibleIssues: []
      }
    };

    // Add diagnostic insights
    if (matchingTeams.length === 0 && allTeams.length > 0) {
      analysis.diagnostics.possibleIssues.push('No exact matches found - possible code mismatch');
    }
    
    if (similarTeams.length > matchingTeams.length) {
      analysis.diagnostics.possibleIssues.push('Case sensitivity issue detected');
    }
    
    if (trimmedCodeTeams.length > matchingTeams.length) {
      analysis.diagnostics.possibleIssues.push('Whitespace issue detected');
    }
    
    if (teamsWithServerMembers.length > matchingTeams.length) {
      analysis.diagnostics.possibleIssues.push('Teams exist with server members but wrong server code');
    }

    if (studentsInServer.length > 0 && matchingTeams.length === 0) {
      analysis.diagnostics.possibleIssues.push('Students in server but no teams - teams not created or wrong server code used');
    }

    console.log('🔍 Analysis complete:', analysis.diagnostics.possibleIssues);
    
    res.json({
      success: true,
      analysis,
      recommendations: generateRecommendations(analysis)
    });
  } catch (error) {
    console.error('❌ Debug analysis error:', error);
    res.status(500).json({
      message: error.message || 'Failed to analyze teams',
      success: false
    });
  }
});

function generateRecommendations(analysis) {
  const recommendations = [];
  
  if (analysis.diagnostics.possibleIssues.includes('Case sensitivity issue detected')) {
    recommendations.push({
      issue: 'Case Sensitivity',
      solution: 'Update team queries to use case-insensitive matching',
      code: 'projectServer: { $regex: new RegExp(server.code, "i") }'
    });
  }
  
  if (analysis.diagnostics.possibleIssues.includes('Whitespace issue detected')) {
    recommendations.push({
      issue: 'Whitespace Mismatch',
      solution: 'Ensure server codes are trimmed during team creation and queries',
      code: 'projectServer: server.code.trim()'
    });
  }
  
  if (analysis.diagnostics.possibleIssues.includes('Teams exist with server members but wrong server code')) {
    recommendations.push({
      issue: 'Wrong Server Code in Teams',
      solution: 'Teams were created with incorrect server code - need to update team records',
      code: 'Update StudentTeam documents with correct projectServer value'
    });
  }
  
  if (analysis.students.inServer > 0 && analysis.teams.exactMatches === 0) {
    recommendations.push({
      issue: 'No Teams Created',
      solution: 'Students need to create teams using the correct server code',
      code: `Students should use server code: "${analysis.server.code}"`
    });
  }
  
  return recommendations;
}

// 🔧 Fix route: Update team server codes if mismatch detected
router.post('/fix/server/:serverId/update-team-codes', verifyToken, async (req, res) => {
  console.log('🔧 FIX: UPDATE TEAM CODES route hit');
  
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        message: 'Faculty access required',
        success: false
      });
    }

    const { serverId } = req.params;
    const { forceUpdate = false } = req.body;
    
    // Get the project server
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    // Check if faculty owns the server
    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only fix teams for your own servers',
        success: false 
      });
    }

    // Get students in this server
    const studentsInServer = await Student.find({ 
      joinedServers: serverId 
    }).select('_id');
    
    const studentIds = studentsInServer.map(s => s._id);

    // Find teams that have members from this server but wrong server code
    const teamsToFix = await StudentTeam.find({
      members: { $in: studentIds },
      projectServer: { $ne: server.code }
    });

    if (teamsToFix.length === 0) {
      return res.json({
        success: true,
        message: 'No teams need fixing',
        teamsFixed: 0
      });
    }

    let teamsFixed = 0;
    const fixedTeams = [];

    for (const team of teamsToFix) {
      // Check if team members are primarily from this server
      const teamMemberIds = team.members.map(m => m.toString());
      const serverMembersInTeam = teamMemberIds.filter(id => 
        studentIds.some(sId => sId.toString() === id)
      );
      
      // If majority of team members are from this server, update the team
      if (serverMembersInTeam.length >= team.members.length / 2 || forceUpdate) {
        const oldCode = team.projectServer;
        team.projectServer = server.code;
        await team.save();
        
        fixedTeams.push({
          teamName: team.name,
          oldCode,
          newCode: server.code,
          memberCount: team.members.length
        });
        teamsFixed++;
        
        console.log(`✅ Fixed team "${team.name}": ${oldCode} → ${server.code}`);
      }
    }

    res.json({
      success: true,
      message: `Fixed ${teamsFixed} team(s)`,
      teamsFixed,
      fixedTeams,
      server: {
        id: server._id,
        title: server.title,
        code: server.code
      }
    });
  } catch (error) {
    console.error('❌ Fix team codes error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fix team codes',
      success: false
    });
  }
});

// 🔧 Enhanced team fetching with multiple fallback strategies
router.get('/enhanced/server/:serverId/teams', verifyToken, async (req, res) => {
  console.log('🔧 ENHANCED GET TEAMS route hit');
  
  try {
    const { serverId } = req.params;
    
    // Get the project server
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: 'Server not found',
        success: false 
      });
    }

    // Check permissions
    if (req.user.role === 'faculty' && server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only access teams from your own servers',
        success: false 
      });
    }

    let teams = [];
    let strategy = '';

    // Strategy 1: Exact match
    teams = await StudentTeam.find({ 
      projectServer: server.code 
    })
    .populate('members', 'firstName lastName email')
    .sort({ createdAt: -1 });

    if (teams.length > 0) {
      strategy = 'exact_match';
    } else {
      // Strategy 2: Case-insensitive match
      teams = await StudentTeam.find({ 
        projectServer: { $regex: new RegExp(`^${server.code}$`, 'i') }
      })
      .populate('members', 'firstName lastName email')
      .sort({ createdAt: -1 });

      if (teams.length > 0) {
        strategy = 'case_insensitive';
      } else {
        // Strategy 3: Find teams with members from this server
        const studentsInServer = await Student.find({ 
          joinedServers: serverId 
        }).select('_id');
        
        const studentIds = studentsInServer.map(s => s._id);

        teams = await StudentTeam.find({
          members: { $in: studentIds }
        })
        .populate('members', 'firstName lastName email')
        .sort({ createdAt: -1 });

        strategy = teams.length > 0 ? 'member_based' : 'none_found';
      }
    }

    console.log(`✅ Found ${teams.length} teams using strategy: ${strategy}`);
    
    res.json({
      success: true,
      teams,
      strategy,
      server: {
        id: server._id,
        title: server.title,
        code: server.code
      },
      message: teams.length === 0 ? 'No teams found' : `Found ${teams.length} teams`
    });
  } catch (error) {
    console.error('❌ Enhanced get teams error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch teams',
      success: false
    });
  }
});
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      serverId, 
      teamIds, // Now accepts array of team IDs
      dueDate, 
      maxPoints,
      assignToAll // Boolean flag to assign to all teams
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
        title,
        description,
        server: serverId,
        team: team._id,
        faculty: req.user.id,
        dueDate: new Date(dueDate),
        maxPoints: maxPoints || 100
      });
      
      await task.save();
      createdTasks.push(task);
      
      // Send notifications to team members
      await NotificationService.notifyTaskAssigned(task, team, server);
    }

    res.status(201).json({ 
      success: true, 
      message: `Task created and assigned to ${createdTasks.length} team(s)`,
      tasks: createdTasks,
      teamsAssigned: targetTeams.length
    });

  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to create task',
      success: false 
    });
  }
});

// ===== ENHANCED TASK SUBMISSION WITH COLLABORATORS =====
// Update the submission endpoint in taskRoutes.js

router.post('/:taskId/submit', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment, collaborators } = req.body; // collaborators is array of student IDs
    
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Only students can submit tasks',
        success: false 
      });
    }
    
    const task = await Task.findById(taskId)
      .populate('server')
      .populate('team', 'members');
      
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        success: false 
      });
    }

    // Verify student is part of the team
    if (!task.team.members.some(member => member.toString() === req.user.id)) {
      return res.status(403).json({ 
        message: 'You are not a member of the team assigned to this task',
        success: false 
      });
    }

    // Verify collaborators are team members
    let validCollaborators = [];
    if (collaborators && Array.isArray(collaborators)) {
      validCollaborators = collaborators.filter(collab => 
        task.team.members.some(member => member.toString() === collab)
      );
    }

    // Check if already submitted
    const existingSubmission = task.submissions.find(s => s.student.toString() === req.user.id);
    if (existingSubmission) {
      return res.status(400).json({ 
        message: 'You have already submitted this task',
        success: false 
      });
    }

    // Create submission
    const submission = {
      student: req.user.id,
      submittedAt: new Date(),
      status: 'submitted',
      comment: comment || '',
      collaborators: validCollaborators,
      file: req.file ? {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size
      } : null
    };

    task.submissions.push(submission);
    await task.save();

    // Notify faculty
    const student = await Student.findById(req.user.id);
    await NotificationService.notifyTaskSubmitted(task, submission, student);

    res.json({ 
      success: true, 
      message: 'Task submitted successfully',
      submission: {
        submittedAt: submission.submittedAt,
        status: submission.status,
        comment: submission.comment,
        hasFile: !!submission.file,
        collaborators: validCollaborators.length
      }
    });
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to submit task',
      success: false 
    });
  }
});
module.exports = router;