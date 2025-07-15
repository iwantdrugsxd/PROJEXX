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

module.exports = router;