const express = require("express");
const router = express.Router();
const ProjectServer = require("../models/projectServerSchema");
const Student = require("../models/studentSchema");
const StudentTeam = require("../models/studentTeamSchema");
const Task = require("../models/taskSchema");
const verifyToken = require("../middleware/verifyToken");
const NotificationService = require('../services/notificationService');

console.log("🔧 projectServerRoutes.js loaded");

// ✅ Create project server (Faculty only)
router.post("/create", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can create project servers",
        success: false 
      });
    }

    const { title, description } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ 
        message: "Project title is required",
        success: false 
      });
    }

    if (title.trim().length < 3) {
      return res.status(400).json({ 
        message: "Project title must be at least 3 characters long",
        success: false 
      });
    }

    // Generate unique server code
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let serverCode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      serverCode = generateCode();
      const existingServer = await ProjectServer.findOne({ code: serverCode });
      if (!existingServer) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ 
        message: "Failed to generate unique server code. Please try again.",
        success: false 
      });
    }

    const projectServer = new ProjectServer({
      title: title.trim(),
      description: description ? description.trim() : "",
      code: serverCode,
      faculty: req.user.id,
      createdAt: new Date(),
      isActive: true
    });

    await projectServer.save();

    // Populate faculty details for response
    await projectServer.populate('faculty', 'firstName lastName email');

    console.log(`✅ Project server created: ${projectServer.title} (${serverCode}) by faculty ${req.user.id}`);

    res.status(201).json({
      message: "Project server created successfully",
      success: true,
      server: projectServer
    });

  } catch (err) {
    console.error("Error creating project server:", err);
    res.status(500).json({ 
      message: "Failed to create project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get faculty's project servers
router.get("/faculty-servers", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can access this endpoint",
        success: false 
      });
    }

    const projectServers = await ProjectServer.find({ faculty: req.user.id })
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Add statistics for each server
    const serversWithStats = await Promise.all(
      projectServers.map(async (server) => {
        const serverObj = server.toObject();
        
        // Get teams count
        const teamsCount = await StudentTeam.countDocuments({ 
          projectServer: server.code 
        });
        
        // Get tasks count
        const tasksCount = await Task.countDocuments({ 
          server: server._id 
        });
        
        // Get unique students count (from teams)
        const teams = await StudentTeam.find({ 
          projectServer: server.code 
        }).populate('members', '_id');
        
        const uniqueStudents = new Set();
        teams.forEach(team => {
          team.members.forEach(member => {
            uniqueStudents.add(member._id.toString());
          });
        });
        
        serverObj.stats = {
          teamsCount,
          tasksCount,
          studentsCount: uniqueStudents.size,
          lastActivity: server.updatedAt
        };
        
        return serverObj;
      })
    );

    console.log(`✅ Found ${projectServers.length} servers for faculty ${req.user.id}`);

    res.status(200).json({
      success: true,
      servers: serversWithStats,
      message: projectServers.length === 0 ? "No project servers found" : `Found ${projectServers.length} project servers`
    });

  } catch (err) {
    console.error("Error fetching faculty servers:", err);
    res.status(500).json({ 
      message: "Failed to fetch project servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get student's project servers (based on team membership)
router.get("/student-servers", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can access this endpoint",
        success: false 
      });
    }

    // ✅ UPDATED: Get servers based on team membership instead of direct server membership
    const studentTeams = await StudentTeam.find({ 
      members: req.user.id 
    }).populate('members', 'firstName lastName email');

    if (studentTeams.length === 0) {
      return res.status(200).json({
        success: true,
        servers: [],
        message: "No project servers found. Create or join a team to access servers.",
        info: "Servers are accessed through team membership"
      });
    }

    // Get unique server codes from teams
    const serverCodes = [...new Set(studentTeams.map(team => team.projectServer))];
    
    // Get server details
    const projectServers = await ProjectServer.find({ 
      code: { $in: serverCodes } 
    })
    .populate('faculty', 'firstName lastName email')
    .sort({ createdAt: -1 });

    // Add team information to each server
    const serversWithTeams = projectServers.map(server => {
      const serverObj = server.toObject();
      serverObj.studentTeams = studentTeams
        .filter(team => team.projectServer === server.code)
        .map(team => ({
          id: team._id,
          name: team.name,
          members: team.members,
          creator: team.creator
        }));
      return serverObj;
    });

    console.log(`✅ Found ${projectServers.length} servers for student ${req.user.id} via team membership`);

    res.status(200).json({
      success: true,
      servers: serversWithTeams,
      teamsCount: studentTeams.length,
      message: projectServers.length === 0 ? "No project servers found" : `Found ${projectServers.length} project servers via ${studentTeams.length} teams`
    });

  } catch (err) {
    console.error("Error fetching student servers:", err);
    res.status(500).json({ 
      message: "Failed to fetch project servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Join project server (OPTIONAL - no longer required)
router.post("/join", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can join project servers",
        success: false 
      });
    }

    const { code } = req.body;

    if (!code || code.trim().length === 0) {
      return res.status(400).json({ 
        message: "Server code is required",
        success: false 
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    const projectServer = await ProjectServer.findOne({ code: normalizedCode })
      .populate('faculty', 'firstName lastName email');

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Invalid server code. Please check and try again.",
        success: false 
      });
    }

    // Check if already joined
    const student = await Student.findById(req.user.id);
    if (student.joinedServers.includes(projectServer._id)) {
      return res.status(200).json({ 
        message: "You have already joined this project server",
        success: true,
        info: "Server joining is optional - you can create teams directly using the server code",
        server: {
          _id: projectServer._id,
          title: projectServer.title,
          description: projectServer.description,
          code: projectServer.code,
          faculty: projectServer.faculty
        }
      });
    }

    // ✅ OPTIONAL: Still allow joining for those who want to
    // But make it clear it's not required
    student.joinedServers.push(projectServer._id);
    await student.save();

    console.log(`✅ Student ${req.user.id} optionally joined server ${normalizedCode}`);

    res.json({
      message: "Successfully joined project server (optional step - you can create teams directly using server code)",
      success: true,
      server: {
        _id: projectServer._id,
        title: projectServer.title,
        description: projectServer.description,
        code: projectServer.code,
        faculty: projectServer.faculty
      },
      info: "You can now create teams directly without joining servers first"
    });

  } catch (err) {
    console.error("Error joining server:", err);
    res.status(500).json({ 
      message: "Failed to join server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get project server details
router.get("/:serverId", verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;

    const projectServer = await ProjectServer.findById(serverId)
      .populate('faculty', 'firstName lastName email');

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Check access permissions
    let hasAccess = false;

    if (req.user.role === 'faculty') {
      // Faculty can access their own servers
      hasAccess = projectServer.faculty._id.toString() === req.user.id;
    } else {
      // ✅ UPDATED: Students can access servers if they're in a team for that server
      const studentTeam = await StudentTeam.findOne({
        members: req.user.id,
        projectServer: projectServer.code
      });
      hasAccess = !!studentTeam;
    }

    if (!hasAccess) {
      return res.status(403).json({ 
        message: req.user.role === 'faculty' 
          ? "You can only access your own servers" 
          : "You need to be in a team for this server to access it",
        success: false 
      });
    }

    // Get additional statistics
    const teamsCount = await StudentTeam.countDocuments({ 
      projectServer: projectServer.code 
    });
    
    const tasksCount = await Task.countDocuments({ 
      server: serverId 
    });

    // Get unique students count
    const teams = await StudentTeam.find({ 
      projectServer: projectServer.code 
    }).populate('members', '_id');
    
    const uniqueStudents = new Set();
    teams.forEach(team => {
      team.members.forEach(member => {
        uniqueStudents.add(member._id.toString());
      });
    });

    const serverWithStats = {
      ...projectServer.toObject(),
      stats: {
        teamsCount,
        tasksCount,
        studentsCount: uniqueStudents.size
      }
    };

    console.log(`✅ Server details retrieved for ${serverId} by ${req.user.role} ${req.user.id}`);

    res.json({
      success: true,
      server: serverWithStats
    });

  } catch (err) {
    console.error("Error fetching server details:", err);
    res.status(500).json({ 
      message: "Failed to fetch server details", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Update project server (Faculty only)
router.put("/:serverId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can update project servers",
        success: false 
      });
    }

    const { serverId } = req.params;
    const { title, description, isActive } = req.body;

    const projectServer = await ProjectServer.findById(serverId);

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Verify ownership
    if (projectServer.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only update your own project servers",
        success: false 
      });
    }

    // Validate inputs
    if (title && title.trim().length < 3) {
      return res.status(400).json({ 
        message: "Project title must be at least 3 characters long",
        success: false 
      });
    }

    // Update fields
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (isActive !== undefined) updates.isActive = isActive;
    updates.updatedAt = new Date();

    const updatedServer = await ProjectServer.findByIdAndUpdate(
      serverId,
      updates,
      { new: true, runValidators: true }
    ).populate('faculty', 'firstName lastName email');

    console.log(`✅ Project server ${serverId} updated by faculty ${req.user.id}`);

    res.json({
      success: true,
      message: "Project server updated successfully",
      server: updatedServer
    });

  } catch (err) {
    console.error("Error updating project server:", err);
    res.status(500).json({ 
      message: "Failed to update project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Delete project server (Faculty only)
router.delete("/:serverId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can delete project servers",
        success: false 
      });
    }

    const { serverId } = req.params;

    const projectServer = await ProjectServer.findById(serverId);

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Verify ownership
    if (projectServer.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only delete your own project servers",
        success: false 
      });
    }

    // Check if server has teams or tasks
    const teamsCount = await StudentTeam.countDocuments({ 
      projectServer: projectServer.code 
    });
    
    const tasksCount = await Task.countDocuments({ 
      server: serverId 
    });

    if (teamsCount > 0 || tasksCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete server with existing teams (${teamsCount}) or tasks (${tasksCount}). Delete teams and tasks first.`,
        success: false,
        stats: { teamsCount, tasksCount }
      });
    }

    // Remove server from students' joinedServers (if any)
    await Student.updateMany(
      { joinedServers: serverId },
      { $pull: { joinedServers: serverId } }
    );

    await ProjectServer.findByIdAndDelete(serverId);

    console.log(`✅ Project server ${serverId} deleted by faculty ${req.user.id}`);

    res.json({
      success: true,
      message: "Project server deleted successfully"
    });

  } catch (err) {
    console.error("Error deleting project server:", err);
    res.status(500).json({ 
      message: "Failed to delete project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get server analytics/dashboard data
router.get("/:serverId/analytics", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can view server analytics",
        success: false 
      });
    }

    const { serverId } = req.params;

    const projectServer = await ProjectServer.findById(serverId);

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Verify ownership
    if (projectServer.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only view analytics for your own servers",
        success: false 
      });
    }

    // Get detailed analytics
    const teams = await StudentTeam.find({ 
      projectServer: projectServer.code 
    }).populate('members', 'firstName lastName email');

    const tasks = await Task.find({ 
      server: serverId 
    }).populate('team', 'name');

    // Calculate metrics
    const uniqueStudents = new Set();
    teams.forEach(team => {
      team.members.forEach(member => {
        uniqueStudents.add(member._id.toString());
      });
    });

    const totalSubmissions = tasks.reduce((sum, task) => sum + task.submissions.length, 0);
    const gradedSubmissions = tasks.reduce((sum, task) => 
      sum + task.submissions.filter(sub => sub.status === 'graded').length, 0
    );

    const activeTasks = tasks.filter(task => task.status === 'active').length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;

    // Team performance
    const teamPerformance = teams.map(team => {
      const teamTasks = tasks.filter(task => 
        task.team._id.toString() === team._id.toString()
      );
      
      const teamSubmissions = teamTasks.reduce((sum, task) => 
        sum + task.submissions.length, 0
      );
      
      const teamGradedSubmissions = teamTasks.reduce((sum, task) => 
        sum + task.submissions.filter(sub => sub.status === 'graded').length, 0
      );

      return {
        teamId: team._id,
        teamName: team.name,
        membersCount: team.members.length,
        tasksAssigned: teamTasks.length,
        submissionsCount: teamSubmissions,
        gradedCount: teamGradedSubmissions,
        completionRate: teamTasks.length > 0 ? 
          Math.round((teamSubmissions / (teamTasks.length * team.members.length)) * 100) : 0
      };
    });

    const analytics = {
      server: {
        id: projectServer._id,
        title: projectServer.title,
        code: projectServer.code,
        createdAt: projectServer.createdAt
      },
      overview: {
        studentsCount: uniqueStudents.size,
        teamsCount: teams.length,
        tasksCount: tasks.length,
        activeTasks,
        completedTasks,
        totalSubmissions,
        gradedSubmissions,
        gradingProgress: totalSubmissions > 0 ? 
          Math.round((gradedSubmissions / totalSubmissions) * 100) : 0
      },
      teamPerformance,
      recentActivity: {
        recentTeams: teams.slice(0, 5).map(team => ({
          name: team.name,
          membersCount: team.members.length,
          createdAt: team.createdAt
        })),
        recentTasks: tasks.slice(0, 5).map(task => ({
          title: task.title,
          teamName: task.team.name,
          dueDate: task.dueDate,
          submissionsCount: task.submissions.length
        }))
      }
    };

    console.log(`✅ Analytics retrieved for server ${serverId}`);

    res.json({
      success: true,
      analytics
    });

  } catch (err) {
    console.error("Error fetching server analytics:", err);
    res.status(500).json({ 
      message: "Failed to fetch server analytics", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Send team creation reminder (Updated for team-only focus)
router.post('/:serverId/remind-team-creation', verifyToken, async (req, res) => {
  console.log('🎯 REMIND TEAM CREATION route hit');
  
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        message: 'Faculty access required',
        success: false
      });
    }

    const { serverId } = req.params;
    const { message: customMessage } = req.body;
    
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
        message: 'You can only send reminders for your own servers',
        success: false
      });
    }

    // ✅ UPDATED: Get all teams for this server
    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    }).populate('members', '_id email firstName lastName');

    const studentsInTeams = new Set();
    const allStudentEmails = new Set();
    
    teams.forEach(team => {
      team.members.forEach(member => {
        studentsInTeams.add(member._id.toString());
        allStudentEmails.add(member.email);
      });
    });

    // Create reminder message focused on team creation only
    const defaultMessage = `
📢 Team Creation Reminder for ${server.title}

Hello! Please create a team for the project server "${server.title}".

🎯 To create a team:
1. Go to the "Teams" tab in your dashboard
2. Click "Create Team"
3. Enter team name and add member emails
4. Use server code: ${server.code}

🤝 To join an existing team:
Ask your classmates for their team details or create a new one!

⏰ Creating teams is required for task assignments and collaboration.
💡 Note: You don't need to join the server first - just create a team directly!

${customMessage ? `\n📝 Additional message from faculty:\n${customMessage}` : ''}

Happy learning! 🚀
    `.trim();

    console.log(`✅ Team creation reminder prepared for server ${server.code}`);
    console.log(`✅ Found ${teams.length} existing teams`);
    
    res.json({
      success: true,
      message: `Team creation reminder prepared for server "${server.title}"`,
      serverCode: server.code,
      existingTeams: teams.length,
      studentsInTeams: studentsInTeams.size,
      reminderMessage: defaultMessage,
      info: "Students can create teams directly without joining the server first"
    });
  } catch (error) {
    console.error('❌ Send team creation reminder error:', error);
    res.status(500).json({
      message: error.message || 'Failed to send reminder',
      success: false
    });
  }
});

// ✅ Get server activity feed
router.get("/:serverId/activity", verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;

    const projectServer = await ProjectServer.findById(serverId);
    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Check access permissions
    let hasAccess = false;

    if (req.user.role === 'faculty') {
      hasAccess = projectServer.faculty.toString() === req.user.id;
    } else {
      // Students can access if they're in a team for this server
      const studentTeam = await StudentTeam.findOne({
        members: req.user.id,
        projectServer: projectServer.code
      });
      hasAccess = !!studentTeam;
    }

    if (!hasAccess) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    // Get recent activity
    const recentTeams = await StudentTeam.find({ 
      projectServer: projectServer.code 
    })
    .populate('members', 'firstName lastName')
    .populate('creator', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(10);

    const recentTasks = await Task.find({ 
      server: serverId 
    })
    .populate('team', 'name')
    .populate('faculty', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(10);

    // Get recent submissions (for faculty)
    let recentSubmissions = [];
    if (req.user.role === 'faculty') {
      const tasksWithSubmissions = await Task.find({ 
        server: serverId,
        'submissions.0': { $exists: true }
      })
      .populate('team', 'name')
      .populate('submissions.student', 'firstName lastName')
      .sort({ 'submissions.submittedAt': -1 })
      .limit(10);

      recentSubmissions = tasksWithSubmissions.flatMap(task => 
        task.submissions.map(submission => ({
          taskTitle: task.title,
          teamName: task.team.name,
          studentName: `${submission.student.firstName} ${submission.student.lastName}`,
          submittedAt: submission.submittedAt,
          status: submission.status
        }))
      ).slice(0, 10);
    }

    const activity = {
      recentTeams: recentTeams.map(team => ({
        name: team.name,
        creator: `${team.creator.firstName} ${team.creator.lastName}`,
        membersCount: team.members.length,
        createdAt: team.createdAt
      })),
      recentTasks: recentTasks.map(task => ({
        title: task.title,
        teamName: task.team.name,
        createdBy: `${task.faculty.firstName} ${task.faculty.lastName}`,
        dueDate: task.dueDate,
        createdAt: task.createdAt
      })),
      recentSubmissions
    };

    console.log(`✅ Activity feed retrieved for server ${serverId}`);

    res.json({
      success: true,
      activity
    });

  } catch (err) {
    console.error("Error fetching server activity:", err);
    res.status(500).json({ 
      message: "Failed to fetch server activity", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

module.exports = router;