// backend/routes/projectServerRoutes.js - COMPLETE NO AUTHENTICATION VERSION
const express = require("express");
const router = express.Router();

// Import models with correct paths
const ProjectServer = require("../models/projectServerSchema");
const StudentTeam = require("../models/studentTeamSchema");
const Task = require("../models/taskSchema");
const Student = require("../models/studentSchema");

// ✅ NO verifyToken middleware - direct access

// Enhanced logging function
const logWithTimestamp = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [PROJECT_SERVER] [${level.toUpperCase()}] ${message}`, data);
};

// ✅ HEALTH CHECK ENDPOINT
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    route: 'projectServers',
    authentication: 'disabled',
    availableEndpoints: [
      'POST /create - Create project server',
      'GET /faculty-servers?facultyId=ID - Get faculty servers',
      'GET /student-servers?studentId=ID - Get student servers',
      'POST /join - Join project server',
      'GET /:serverId?userId=ID&userRole=ROLE - Get server details',
      'PUT /:serverId - Update server',
      'DELETE /:serverId - Delete server'
    ]
  });
});

// ✅ Create project server - Modified to accept facultyId in body
router.post("/create", async (req, res) => {
  try {
    const { title, description, facultyId, userRole } = req.body;
    
    logWithTimestamp('info', 'Project server creation attempt', {
      facultyId: facultyId,
      userRole: userRole,
      body: req.body
    });

    if (!facultyId) {
      return res.status(400).json({ 
        message: "facultyId is required in request body",
        success: false,
        example: {
          title: "My Project Server",
          description: "Server description",
          facultyId: "507f1f77bcf86cd799439011",
          userRole: "faculty"
        }
      });
    }

    const role = userRole || 'faculty';
    if (role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can create project servers",
        success: false 
      });
    }

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ 
        message: "Project title must be at least 3 characters long",
        success: false 
      });
    }

    // Generate unique server code
    let code;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const existing = await ProjectServer.findOne({ code });
      if (!existing) {
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

    const newServer = new ProjectServer({
      title: title.trim(),
      description: description?.trim() || '',
      code,
      faculty: facultyId,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    });

    await newServer.save();

    const populatedServer = await ProjectServer.findById(newServer._id)
      .populate('faculty', 'firstName lastName email');

    logWithTimestamp('info', 'Project server created successfully', {
      serverId: newServer._id,
      serverCode: code,
      facultyId: facultyId
    });

    res.status(201).json({
      success: true,
      message: "Project server created successfully",
      server: populatedServer,
      serverCode: code
    });

  } catch (err) {
    logWithTimestamp('error', 'Project server creation failed', {
      error: err.message,
      stack: err.stack,
      facultyId: req.body.facultyId
    });

    res.status(500).json({ 
      message: "Failed to create project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get faculty's project servers - Modified to accept facultyId as query param
router.get("/faculty-servers", async (req, res) => {
  try {
    const { facultyId } = req.query;
    
    logWithTimestamp('info', 'Faculty servers request', {
      facultyId: facultyId
    });

    if (!facultyId) {
      return res.status(400).json({ 
        message: "facultyId query parameter is required",
        success: false,
        example: "GET /api/projectServers/faculty-servers?facultyId=507f1f77bcf86cd799439011"
      });
    }

    // Fetch faculty's project servers
    const projectServers = await ProjectServer.find({ faculty: facultyId })
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    logWithTimestamp('info', 'Project servers fetched', {
      count: projectServers.length,
      facultyId: facultyId
    });

    if (projectServers.length === 0) {
      return res.status(200).json({
        success: true,
        servers: [],
        message: "No project servers found. Create your first server!",
        createServerEndpoint: "POST /api/projectServers/create"
      });
    }

    // Add detailed stats to each server
    const serversWithStats = await Promise.all(projectServers.map(async (server) => {
      try {
        // Get teams for this server
        const teams = await StudentTeam.find({ 
          projectServer: server.code 
        }).populate('members', 'firstName lastName email username');

        // Get tasks for this server
        const tasks = await Task.find({ 
          server: server._id 
        });

        // Calculate stats
        const studentsCount = new Set(teams.flatMap(team => 
          team.members.map(m => m._id.toString())
        )).size;

        // Calculate task completion stats
        let totalSubmissions = 0;
        let gradedSubmissions = 0;
        tasks.forEach(task => {
          if (task.submissions && Array.isArray(task.submissions)) {
            totalSubmissions += task.submissions.length;
            gradedSubmissions += task.submissions.filter(sub => 
              sub.grade !== null && sub.grade !== undefined
            ).length;
          }
        });

        return {
          ...server.toObject(),
          teams: teams,
          tasks: tasks,
          stats: {
            teamsCount: teams.length,
            tasksCount: tasks.length,
            studentsCount: studentsCount,
            totalSubmissions: totalSubmissions,
            gradedSubmissions: gradedSubmissions,
            pendingSubmissions: totalSubmissions - gradedSubmissions,
            lastActivity: server.updatedAt
          }
        };
      } catch (serverError) {
        logWithTimestamp('error', 'Error processing server stats', {
          serverId: server._id,
          error: serverError.message
        });
        
        return {
          ...server.toObject(),
          teams: [],
          tasks: [],
          stats: {
            teamsCount: 0,
            tasksCount: 0,
            studentsCount: 0,
            totalSubmissions: 0,
            gradedSubmissions: 0,
            pendingSubmissions: 0,
            lastActivity: server.updatedAt
          }
        };
      }
    }));

    logWithTimestamp('info', 'Faculty servers response prepared', {
      serverCount: projectServers.length,
      facultyId: facultyId
    });

    res.status(200).json({
      success: true,
      servers: serversWithStats,
      totalServers: projectServers.length,
      message: `Found ${projectServers.length} project servers`,
      summary: {
        totalServers: projectServers.length,
        totalTeams: serversWithStats.reduce((sum, s) => sum + s.stats.teamsCount, 0),
        totalTasks: serversWithStats.reduce((sum, s) => sum + s.stats.tasksCount, 0),
        totalStudents: new Set(serversWithStats.flatMap(s => 
          s.teams.flatMap(t => t.members.map(m => m._id.toString()))
        )).size
      }
    });

  } catch (err) {
    logWithTimestamp('error', 'Faculty servers request failed', {
      error: err.message,
      stack: err.stack,
      facultyId: req.query.facultyId
    });

    res.status(500).json({ 
      message: "Failed to fetch project servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get student's project servers - Modified to accept studentId as query param
router.get("/student-servers", async (req, res) => {
  try {
    const { studentId } = req.query;
    
    logWithTimestamp('info', 'Student requesting their servers', {
      studentId: studentId
    });

    if (!studentId) {
      return res.status(400).json({ 
        message: "studentId query parameter is required",
        success: false,
        example: "GET /api/projectServers/student-servers?studentId=507f1f77bcf86cd799439011"
      });
    }

    // Get teams the student is part of
    const studentTeams = await StudentTeam.find({ 
      members: studentId 
    }).populate('members', 'firstName lastName email username')
      .populate('creator', 'firstName lastName email username');

    logWithTimestamp('info', 'Student teams found', {
      studentId: studentId,
      teamCount: studentTeams.length
    });

    if (studentTeams.length === 0) {
      return res.status(200).json({
        success: true,
        servers: [],
        teamsCount: 0,
        message: "No project servers found. Create or join a team to access servers.",
        info: "Servers are accessed through team membership",
        suggestions: [
          "Join an existing team using a team invite",
          "Create a new team for a project server",
          "Contact your instructor for server access codes"
        ]
      });
    }

    // Get unique server codes from teams
    const serverCodes = [...new Set(studentTeams.map(team => team.projectServer))];
    logWithTimestamp('debug', 'Server codes from teams', { 
      serverCodes,
      studentId: studentId 
    });
    
    // Get server details
    const projectServers = await ProjectServer.find({ 
      code: { $in: serverCodes } 
    })
    .populate('faculty', 'firstName lastName email')
    .sort({ createdAt: -1 });

    logWithTimestamp('info', 'Project servers found for student', {
      studentId: studentId,
      serverCount: projectServers.length
    });

    // Add complete team information and student-specific data to each server
    const serversWithTeams = await Promise.all(projectServers.map(async (server) => {
      const serverObj = server.toObject();
      
      // Get teams for this specific server that the student is in
      const serverTeams = studentTeams.filter(team => team.projectServer === server.code);
      
      // Get all tasks for this server
      const serverTasks = await Task.find({ 
        server: server._id 
      }).populate('team', 'name');

      // Filter tasks that are accessible to the student (through their teams)
      const studentTeamIds = serverTeams.map(team => team._id.toString());
      const accessibleTasks = serverTasks.filter(task => 
        !task.team || studentTeamIds.includes(task.team._id.toString())
      );

      // Calculate student-specific task statistics
      let studentCompletedTasks = 0;
      let studentPendingTasks = 0;
      let studentOverdueTasks = 0;

      accessibleTasks.forEach(task => {
        const hasSubmission = task.submissions && task.submissions.some(sub => 
          sub.student && sub.student.toString() === studentId
        );
        
        if (hasSubmission) {
          studentCompletedTasks++;
        } else {
          studentPendingTasks++;
          
          // Check if overdue
          if (task.dueDate && new Date() > new Date(task.dueDate)) {
            studentOverdueTasks++;
          }
        }
      });

      serverObj.studentTeams = serverTeams.map(team => ({
        id: team._id,
        _id: team._id,
        name: team.name,
        members: team.members,
        creator: team.creator,
        createdAt: team.createdAt,
        description: team.description || '',
        isCreator: team.creator._id.toString() === studentId,
        memberCount: team.members.length
      }));
      
      serverObj.studentStats = {
        accessibleTasks: accessibleTasks.length,
        completedTasks: studentCompletedTasks,
        pendingTasks: studentPendingTasks,
        overdueTasks: studentOverdueTasks,
        completionRate: accessibleTasks.length > 0 ? 
          Math.round((studentCompletedTasks / accessibleTasks.length) * 100) : 0
      };

      serverObj.teamsCount = serverTeams.length;
      serverObj.totalTasks = accessibleTasks.length;
      
      return serverObj;
    }));

    logWithTimestamp('info', 'Student servers response ready', {
      studentId: studentId,
      serverCount: projectServers.length,
      teamCount: studentTeams.length
    });

    res.status(200).json({
      success: true,
      servers: serversWithTeams,
      teamsCount: studentTeams.length,
      totalServers: projectServers.length,
      message: projectServers.length === 0 ? 
        "No project servers found" : 
        `Found ${projectServers.length} project servers via ${studentTeams.length} teams`,
      summary: {
        totalServers: projectServers.length,
        totalTeams: studentTeams.length,
        totalTasks: serversWithTeams.reduce((sum, s) => sum + s.totalTasks, 0),
        completedTasks: serversWithTeams.reduce((sum, s) => sum + s.studentStats.completedTasks, 0),
        pendingTasks: serversWithTeams.reduce((sum, s) => sum + s.studentStats.pendingTasks, 0)
      }
    });

  } catch (err) {
    logWithTimestamp('error', 'Error fetching student servers', {
      error: err.message,
      stack: err.stack,
      studentId: req.query.studentId
    });

    res.status(500).json({ 
      message: "Failed to fetch project servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Join project server - Modified to accept studentId in body
router.post("/join", async (req, res) => {
  try {
    const { code, studentId, userRole } = req.body;
    
    logWithTimestamp('info', 'Student attempting to join server', {
      studentId: studentId,
      code: code
    });

    if (!studentId) {
      return res.status(400).json({ 
        message: "studentId is required in request body",
        success: false,
        example: {
          code: "ABC123",
          studentId: "507f1f77bcf86cd799439011",
          userRole: "student"
        }
      });
    }

    const role = userRole || 'student';
    if (role !== "student") {
      return res.status(403).json({ 
        message: "Only students can join project servers",
        success: false 
      });
    }

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
        success: false,
        hint: "Server codes are 6 characters long and contain letters/numbers"
      });
    }

    // Check if already joined
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    if (student.joinedServers && student.joinedServers.includes(projectServer._id)) {
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

    // Add to joined servers (optional step)
    if (!student.joinedServers) {
      student.joinedServers = [];
    }
    student.joinedServers.push(projectServer._id);
    await student.save();

    logWithTimestamp('info', 'Student joined server successfully', {
      studentId: studentId,
      serverCode: normalizedCode,
      serverTitle: projectServer.title
    });

    res.json({
      message: "Successfully joined project server",
      success: true,
      server: {
        _id: projectServer._id,
        title: projectServer.title,
        description: projectServer.description,
        code: projectServer.code,
        faculty: projectServer.faculty
      },
      nextSteps: [
        "You can now create teams for this server",
        "Join existing teams using team invites",
        "Access tasks assigned to your teams"
      ]
    });

  } catch (err) {
    logWithTimestamp('error', 'Error joining server', {
      error: err.message,
      studentId: req.body.studentId
    });

    res.status(500).json({ 
      message: "Failed to join server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get project server details WITH TEAMS AND TASKS
router.get("/:serverId", async (req, res) => {
  try {
    const { serverId } = req.params;
    const { userId, userRole } = req.query;
    
    logWithTimestamp('info', 'Getting server details', {
      serverId,
      userId: userId,
      userRole: userRole
    });

    if (!userId) {
      return res.status(400).json({ 
        message: "userId query parameter is required",
        success: false,
        example: "GET /api/projectServers/12345?userId=507f1f77bcf86cd799439011&userRole=student"
      });
    }

    const projectServer = await ProjectServer.findById(serverId)
      .populate('faculty', 'firstName lastName email');

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Get teams for this server
    const teams = await StudentTeam.find({ 
      projectServer: projectServer.code 
    }).populate('members', 'firstName lastName email username')
      .populate('creator', 'firstName lastName email username');

    // Get tasks for this server
    const tasks = await Task.find({ 
      server: serverId 
    }).populate('team', 'name members')
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Add access control and user-specific data
    let userSpecificData = {};
    const role = userRole || 'student';

    if (role === 'student') {
      // Check if student has access (is in any team for this server)
      const studentTeams = teams.filter(team => 
        team.members.some(member => member._id.toString() === userId)
      );

      if (studentTeams.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You must be in a team for this server to view details.",
          serverInfo: {
            title: projectServer.title,
            code: projectServer.code,
            faculty: projectServer.faculty
          },
          suggestion: "Join a team for this server to access full details"
        });
      }

      // Add student-specific task data
      const accessibleTasks = tasks.filter(task => 
        !task.team || studentTeams.some(team => 
          team._id.toString() === task.team._id.toString()
        )
      );

      userSpecificData = {
        userTeams: studentTeams,
        accessibleTasks: accessibleTasks,
        taskStats: {
          total: accessibleTasks.length,
          completed: accessibleTasks.filter(task => 
            task.submissions && task.submissions.some(sub => 
              sub.student && sub.student.toString() === userId
            )
          ).length,
          pending: accessibleTasks.filter(task => 
            !task.submissions || !task.submissions.some(sub => 
              sub.student && sub.student.toString() === userId
            )
          ).length
        }
      };
    } else if (role === 'faculty') {
      // Check if faculty owns this server
      if (projectServer.faculty._id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own project servers."
        });
      }

      // Add faculty-specific data
      userSpecificData = {
        allTeams: teams,
        allTasks: tasks,
        serverStats: {
          totalTeams: teams.length,
          totalTasks: tasks.length,
          totalStudents: new Set(teams.flatMap(team => 
            team.members.map(m => m._id.toString())
          )).size,
          totalSubmissions: tasks.reduce((sum, task) => 
            sum + (task.submissions ? task.submissions.length : 0), 0
          )
        }
      };
    }

    logWithTimestamp('info', 'Server details loaded', {
      serverId,
      serverCode: projectServer.code,
      teamsCount: teams.length,
      tasksCount: tasks.length,
      userRole: role
    });

    const serverWithDetails = {
      ...projectServer.toObject(),
      teams: teams,
      tasks: tasks,
      stats: {
        teamsCount: teams.length,
        tasksCount: tasks.length,
        studentsCount: new Set(teams.flatMap(team => 
          team.members.map(m => m._id.toString())
        )).size,
        activeTeams: teams.filter(team => team.status === 'active').length,
        recentActivity: tasks.length > 0 ? 
          Math.max(...tasks.map(t => new Date(t.updatedAt).getTime())) : 
          new Date(projectServer.updatedAt).getTime()
      },
      userAccess: {
        role: role,
        hasAccess: true,
        ...userSpecificData
      }
    };

    res.json({
      success: true,
      server: serverWithDetails
    });

  } catch (err) {
    logWithTimestamp('error', 'Error fetching server details', {
      error: err.message,
      serverId: req.params.serverId
    });

    res.status(500).json({ 
      message: "Failed to fetch server details", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Update project server - Modified to accept facultyId in body
router.put("/:serverId", async (req, res) => {
  try {
    const { serverId } = req.params;
    const { title, description, isActive, facultyId, userRole } = req.body;

    if (!facultyId) {
      return res.status(400).json({ 
        message: "facultyId is required in request body",
        success: false,
        example: {
          title: "Updated Server Title",
          description: "Updated description",
          isActive: true,
          facultyId: "507f1f77bcf86cd799439011",
          userRole: "faculty"
        }
      });
    }

    const role = userRole || 'faculty';
    if (role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can update project servers",
        success: false 
      });
    }

    const projectServer = await ProjectServer.findById(serverId);

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Verify ownership
    if (projectServer.faculty.toString() !== facultyId) {
      return res.status(403).json({ 
        message: "You can only update your own project servers",
        success: false 
      });
    }

    // Prepare updates
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (isActive !== undefined) updates.isActive = isActive;
    updates.updatedAt = new Date();

    // Validate title if provided
    if (updates.title && updates.title.length < 3) {
      return res.status(400).json({ 
        message: "Project title must be at least 3 characters long",
        success: false 
      });
    }

    const updatedServer = await ProjectServer.findByIdAndUpdate(
      serverId,
      updates,
      { new: true, runValidators: true }
    ).populate('faculty', 'firstName lastName email');

    logWithTimestamp('info', 'Project server updated', {
      serverId,
      facultyId: facultyId,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      message: "Project server updated successfully",
      server: updatedServer,
      updatedFields: Object.keys(updates)
    });

  } catch (err) {
    logWithTimestamp('error', 'Error updating project server', {
      error: err.message,
      serverId: req.params.serverId
    });

    res.status(500).json({ 
      message: "Failed to update project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Delete project server - Modified to accept facultyId in body
router.delete("/:serverId", async (req, res) => {
  try {
    const { serverId } = req.params;
    const { facultyId, userRole, forceDelete } = req.body;

    logWithTimestamp('info', 'Faculty attempting to delete server', {
      serverId: serverId,
      facultyId: facultyId,
      forceDelete: forceDelete
    });

    if (!facultyId) {
      return res.status(400).json({ 
        message: "facultyId is required in request body",
        success: false,
        example: {
          facultyId: "507f1f77bcf86cd799439011",
          userRole: "faculty",
          forceDelete: false
        }
      });
    }

    const role = userRole || 'faculty';
    if (role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can delete project servers",
        success: false 
      });
    }

    const projectServer = await ProjectServer.findById(serverId);

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Verify ownership
    if (projectServer.faculty.toString() !== facultyId) {
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

    // Get detailed information about what would be deleted
    const teams = await StudentTeam.find({ 
      projectServer: projectServer.code 
    }).populate('members', 'firstName lastName');

    const tasks = await Task.find({ 
      server: serverId 
    }).populate('team', 'name');

    const totalSubmissions = tasks.reduce((sum, task) => 
      sum + (task.submissions ? task.submissions.length : 0), 0
    );

    const studentsAffected = new Set(teams.flatMap(team => 
      team.members.map(m => m._id.toString())
    )).size;

    if ((teamsCount > 0 || tasksCount > 0) && !forceDelete) {
      return res.status(400).json({ 
        message: `Cannot delete server with existing content. Use forceDelete: true to proceed.`,
        success: false,
        stats: { 
          teamsCount, 
          tasksCount,
          totalSubmissions,
          studentsAffected
        },
        warning: "Deleting this server will permanently remove all associated teams, tasks, and submissions.",
        impactDetails: {
          teams: teams.map(t => ({ name: t.name, memberCount: t.members.length })),
          tasks: tasks.map(t => ({ 
            title: t.title, 
            team: t.team?.name || 'No team',
            submissionsCount: t.submissions ? t.submissions.length : 0
          }))
        },
        toForceDelete: {
          facultyId: facultyId,
          userRole: "faculty",
          forceDelete: true
        }
      });
    }

    // If force delete, remove all associated data
    if (forceDelete && (teamsCount > 0 || tasksCount > 0)) {
      logWithTimestamp('warn', 'Force deleting server with associated data', {
        serverId,
        teamsCount,
        tasksCount,
        totalSubmissions,
        studentsAffected
      });

      // Delete all tasks associated with this server
      await Task.deleteMany({ server: serverId });

      // Delete all teams associated with this server
      await StudentTeam.deleteMany({ projectServer: projectServer.code });

      logWithTimestamp('info', 'Associated data deleted', {
        deletedTasks: tasksCount,
        deletedTeams: teamsCount
      });
    }

    // Remove server from students' joinedServers (if any)
    await Student.updateMany(
      { joinedServers: serverId },
      { $pull: { joinedServers: serverId } }
    );

    await ProjectServer.findByIdAndDelete(serverId);

    logWithTimestamp('info', 'Project server deleted successfully', {
      serverId,
      serverTitle: projectServer.title,
      serverCode: projectServer.code,
      facultyId: facultyId,
      forceDelete: forceDelete
    });

    res.json({
      success: true,
      message: "Project server deleted successfully",
      deletedData: {
        server: {
          id: serverId,
          title: projectServer.title,
          code: projectServer.code
        },
        associatedData: forceDelete ? {
          teamsDeleted: teamsCount,
          tasksDeleted: tasksCount,
          submissionsDeleted: totalSubmissions,
          studentsAffected: studentsAffected
        } : null
      }
    });

  } catch (err) {
    logWithTimestamp('error', 'Error deleting project server', {
      error: err.message,
      stack: err.stack,
      serverId: req.params.serverId
    });

    res.status(500).json({ 
      message: "Failed to delete project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get all project servers (for admin/debugging purposes)
router.get("/", async (req, res) => {
  try {
    const { limit = 50, page = 1, search, facultyId } = req.query;
    
    logWithTimestamp('info', 'Getting all project servers', {
      limit,
      page,
      search,
      facultyId
    });

    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (facultyId) {
      query.faculty = facultyId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [servers, total] = await Promise.all([
      ProjectServer.find(query)
        .populate('faculty', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      ProjectServer.countDocuments(query)
    ]);

    // Add basic stats to each server
    const serversWithBasicStats = await Promise.all(servers.map(async (server) => {
      const teamsCount = await StudentTeam.countDocuments({ 
        projectServer: server.code 
      });
      
      const tasksCount = await Task.countDocuments({ 
        server: server._id 
      });

      return {
        ...server.toObject(),
        basicStats: {
          teamsCount,
          tasksCount,
          isActive: server.isActive !== false
        }
      };
    }));

    logWithTimestamp('info', 'All project servers fetched', {
      count: servers.length,
      total,
      page: parseInt(page),
      hasMore: skip + servers.length < total
    });

    res.json({
      success: true,
      servers: serversWithBasicStats,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + servers.length < total
      },
      summary: {
        totalServers: total,
        activeServers: serversWithBasicStats.filter(s => s.basicStats.isActive).length,
        totalTeams: serversWithBasicStats.reduce((sum, s) => sum + s.basicStats.teamsCount, 0),
        totalTasks: serversWithBasicStats.reduce((sum, s) => sum + s.basicStats.tasksCount, 0)
      }
    });

  } catch (err) {
    logWithTimestamp('error', 'Error fetching all project servers', {
      error: err.message
    });

    res.status(500).json({ 
      message: "Failed to fetch project servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Search project servers by code (public endpoint for students to find servers)
router.get("/search/:code", async (req, res) => {
  try {
    const { code } = req.params;
    
    logWithTimestamp('info', 'Searching for project server by code', {
      code: code
    });

    if (!code || code.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Search code must be at least 3 characters long"
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    
    const server = await ProjectServer.findOne({ 
      code: normalizedCode,
      isActive: { $ne: false }
    }).populate('faculty', 'firstName lastName');

    if (!server) {
      return res.status(404).json({
        success: false,
        message: "No active project server found with that code",
        suggestion: "Check the code and try again, or contact your instructor"
      });
    }

    // Get basic server information (no sensitive data)
    const publicServerInfo = {
      _id: server._id,
      title: server.title,
      description: server.description,
      code: server.code,
      faculty: {
        name: `${server.faculty.firstName} ${server.faculty.lastName}`
      },
      createdAt: server.createdAt,
      isActive: server.isActive !== false
    };

    // Get basic stats
    const teamsCount = await StudentTeam.countDocuments({ 
      projectServer: server.code 
    });
    
    const tasksCount = await Task.countDocuments({ 
      server: server._id 
    });

    logWithTimestamp('info', 'Project server found by code', {
      serverId: server._id,
      serverCode: server.code,
      serverTitle: server.title
    });

    res.json({
      success: true,
      server: {
        ...publicServerInfo,
        stats: {
          teamsCount,
          tasksCount
        }
      },
      joinEndpoint: "POST /api/projectServers/join",
      message: "Server found! Use the join endpoint to join this server."
    });

  } catch (err) {
    logWithTimestamp('error', 'Error searching project server', {
      error: err.message,
      code: req.params.code
    });

    res.status(500).json({ 
      message: "Failed to search project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get server statistics (detailed stats for a specific server)
router.get("/:serverId/stats", async (req, res) => {
  try {
    const { serverId } = req.params;
    const { facultyId, detailed = false } = req.query;
    
    logWithTimestamp('info', 'Getting server statistics', {
      serverId,
      facultyId,
      detailed
    });

    const server = await ProjectServer.findById(serverId);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Project server not found"
      });
    }

    // If facultyId is provided, verify ownership for detailed stats
    if (facultyId && server.faculty.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view detailed stats for your own servers."
      });
    }

    // Get basic stats
    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    }).populate('members', 'firstName lastName');

    const tasks = await Task.find({ 
      server: serverId 
    });

    const studentsCount = new Set(teams.flatMap(team => 
      team.members.map(m => m._id.toString())
    )).size;

    // Calculate submission statistics
    let totalSubmissions = 0;
    let gradedSubmissions = 0;
    let pendingSubmissions = 0;
    let averageGrade = 0;

    tasks.forEach(task => {
      if (task.submissions && Array.isArray(task.submissions)) {
        totalSubmissions += task.submissions.length;
        const taskGradedSubmissions = task.submissions.filter(sub => 
          sub.grade !== null && sub.grade !== undefined
        );
        gradedSubmissions += taskGradedSubmissions.length;
        
        // Calculate average for this task
        if (taskGradedSubmissions.length > 0) {
          const taskAverage = taskGradedSubmissions.reduce((sum, sub) => sum + (sub.grade || 0), 0) / taskGradedSubmissions.length;
          averageGrade += taskAverage;
        }
      }
    });

    pendingSubmissions = totalSubmissions - gradedSubmissions;
    averageGrade = gradedSubmissions > 0 ? averageGrade / tasks.filter(t => 
      t.submissions && t.submissions.some(s => s.grade !== null && s.grade !== undefined)
    ).length : 0;

    const basicStats = {
      server: {
        id: server._id,
        title: server.title,
        code: server.code,
        createdAt: server.createdAt,
        isActive: server.isActive !== false
      },
      counts: {
        teams: teams.length,
        tasks: tasks.length,
        students: studentsCount,
        totalSubmissions,
        gradedSubmissions,
        pendingSubmissions
      },
      performance: {
        averageGrade: Math.round(averageGrade * 100) / 100,
        submissionRate: studentsCount > 0 ? Math.round((totalSubmissions / studentsCount) * 100) / 100 : 0,
        completionRate: totalSubmissions > 0 ? Math.round((gradedSubmissions / totalSubmissions) * 100) : 0
      }
    };

    // Add detailed stats if requested and authorized
    if (detailed === 'true' && facultyId) {
      const detailedStats = {
        teamBreakdown: teams.map(team => ({
          id: team._id,
          name: team.name,
          memberCount: team.members.length,
          createdAt: team.createdAt
        })),
        taskBreakdown: tasks.map(task => ({
          id: task._id,
          title: task.title,
          dueDate: task.dueDate,
          submissionsCount: task.submissions ? task.submissions.length : 0,
          status: task.status,
          createdAt: task.createdAt
        })),
        activityTimeline: {
          teamsCreatedThisWeek: teams.filter(t => 
            new Date(t.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          ).length,
          tasksCreatedThisWeek: tasks.filter(t => 
            new Date(t.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          ).length,
          recentSubmissions: tasks.reduce((sum, task) => {
            if (task.submissions) {
              return sum + task.submissions.filter(sub => 
                new Date(sub.submittedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              ).length;
            }
            return sum;
          }, 0)
        }
      };

      res.json({
        success: true,
        stats: {
          ...basicStats,
          detailed: detailedStats
        }
      });
    } else {
      res.json({
        success: true,
        stats: basicStats
      });
    }

  } catch (err) {
    logWithTimestamp('error', 'Error getting server statistics', {
      error: err.message,
      serverId: req.params.serverId
    });

    res.status(500).json({ 
      message: "Failed to get server statistics", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

module.exports = router;