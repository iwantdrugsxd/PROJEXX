// backend/routes/projectServerRoutes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");

// Import models with correct paths
const ProjectServer = require("../models/projectServerSchema");
const StudentTeam = require("../models/studentTeamSchema");
const Task = require("../models/taskSchema");
const Student = require("../models/studentSchema");

// Enhanced logging function
const logWithTimestamp = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [PROJECT_SERVER] [${level.toUpperCase()}] ${message}`, data);
};

// ✅ Create project server (Faculty only)
router.post("/create", verifyToken, async (req, res) => {
  try {
    logWithTimestamp('info', 'Project server creation attempt', {
      userId: req.user.id,
      userRole: req.user.role,
      body: req.body
    });

    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can create project servers",
        success: false 
      });
    }

    const { title, description } = req.body;

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
      faculty: req.user.id
    });

    await newServer.save();

    const populatedServer = await ProjectServer.findById(newServer._id)
      .populate('faculty', 'firstName lastName email');

    logWithTimestamp('info', 'Project server created successfully', {
      serverId: newServer._id,
      serverCode: code,
      facultyId: req.user.id
    });

    res.status(201).json({
      success: true,
      message: "Project server created successfully",
      server: populatedServer
    });

  } catch (err) {
    logWithTimestamp('error', 'Project server creation failed', {
      error: err.message,
      userId: req.user.id
    });

    res.status(500).json({ 
      message: "Failed to create project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get faculty's project servers WITH TEAMS AND STATS
router.get("/faculty-servers", verifyToken, async (req, res) => {
  try {
    console.log("🔍 === DIAGNOSTIC: Faculty-servers endpoint called ===");
    
    // Step 1: Check if user exists
    console.log("🔍 Step 1 - User check:", {
      userExists: !!req.user,
      userId: req.user?.id,
      userRole: req.user?.role
    });

    if (!req.user) {
      console.log("❌ No user found in request");
      return res.status(401).json({ 
        message: "Authentication required",
        success: false 
      });
    }

    if (req.user.role !== "faculty") {
      console.log("❌ User is not faculty:", req.user.role);
      return res.status(403).json({ 
        message: "Only faculty can access this endpoint",
        success: false 
      });
    }

    console.log("✅ Step 1 passed - User is authenticated faculty");

    // Step 2: Test database connection
    try {
      const mongoose = require('mongoose');
      console.log("🔍 Step 2 - Database connection:", {
        state: mongoose.connection.readyState,
        name: mongoose.connection.name
      });
    } catch (dbError) {
      console.log("❌ Database connection issue:", dbError.message);
    }

    // Step 3: Test ProjectServer model
    console.log("🔍 Step 3 - Testing ProjectServer model...");
    
    const projectServersCount = await ProjectServer.countDocuments({ faculty: req.user.id });
    console.log("✅ ProjectServer query successful. Count:", projectServersCount);

    // Step 4: Fetch actual project servers
    console.log("🔍 Step 4 - Fetching project servers...");
    
    const projectServers = await ProjectServer.find({ faculty: req.user.id })
      .sort({ createdAt: -1 });

    console.log("✅ Project servers fetched:", {
      count: projectServers.length,
      servers: projectServers.map(s => ({ id: s._id, title: s.title, code: s.code }))
    });

    if (projectServers.length === 0) {
      console.log("ℹ️ No project servers found for faculty");
      return res.status(200).json({
        success: true,
        servers: [],
        message: "No project servers found"
      });
    }

    // Step 5: Test populate
    console.log("🔍 Step 5 - Testing populate...");
    
    const populatedServers = await ProjectServer.find({ faculty: req.user.id })
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    console.log("✅ Populate successful");

    // Step 6: Test one server processing
    console.log("🔍 Step 6 - Testing individual server processing...");
    
    const firstServer = populatedServers[0];
    console.log("Processing server:", { id: firstServer._id, code: firstServer.code });

    // Test StudentTeam query
    const teamsCount = await StudentTeam.countDocuments({ 
      projectServer: firstServer.code
    });
    console.log("✅ Teams count query successful:", teamsCount);

    // Test Task query  
    const tasksCount = await Task.countDocuments({ 
      server: firstServer._id 
    });
    console.log("✅ Tasks count query successful:", tasksCount);

    // Step 7: Return simple response (without complex processing)
    console.log("🔍 Step 7 - Returning simple response...");

    const simpleServers = populatedServers.map(server => ({
      ...server.toObject(),
      teams: [], // Empty for now
      stats: {
        teamsCount: 0,
        tasksCount: 0,
        studentsCount: 0,
        lastActivity: server.updatedAt
      }
    }));

    console.log("✅ === DIAGNOSTIC SUCCESSFUL ===");

    res.status(200).json({
      success: true,
      servers: simpleServers,
      message: `Found ${populatedServers.length} project servers`,
      diagnostic: "All steps passed successfully"
    });

  } catch (err) {
    console.log("❌ === DIAGNOSTIC ERROR ===");
    console.log("Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    });

    res.status(500).json({ 
      message: "Failed to fetch project servers", 
      error: err.message,
      diagnostic: "Error occurred during diagnostic",
      success: false 
    });
  }
});
// ✅ Get student's project servers (based on team membership)
router.get("/student-servers", verifyToken, async (req, res) => {
  try {
    logWithTimestamp('info', 'Student requesting their servers', {
      studentId: req.user.id
    });

    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can access this endpoint",
        success: false 
      });
    }

    // Get teams the student is part of
    const studentTeams = await StudentTeam.find({ 
      members: req.user.id 
    }).populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email');

    logWithTimestamp('info', 'Student teams found', {
      studentId: req.user.id,
      teamCount: studentTeams.length
    });

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
    logWithTimestamp('debug', 'Server codes from teams', { serverCodes });
    
    // Get server details
    const projectServers = await ProjectServer.find({ 
      code: { $in: serverCodes } 
    })
    .populate('faculty', 'firstName lastName email')
    .sort({ createdAt: -1 });

    logWithTimestamp('info', 'Project servers found for student', {
      studentId: req.user.id,
      serverCount: projectServers.length
    });

    // Add complete team information to each server
    const serversWithTeams = projectServers.map(server => {
      const serverObj = server.toObject();
      
      // Get teams for this specific server
      const serverTeams = studentTeams.filter(team => team.projectServer === server.code);
      
      serverObj.studentTeams = serverTeams.map(team => ({
        id: team._id,
        _id: team._id,
        name: team.name,
        members: team.members,
        creator: team.creator,
        createdAt: team.createdAt,
        description: team.description || ''
      }));
      
      return serverObj;
    });

    logWithTimestamp('info', 'Student servers response ready', {
      studentId: req.user.id,
      serverCount: projectServers.length,
      teamCount: studentTeams.length
    });

    res.status(200).json({
      success: true,
      servers: serversWithTeams,
      teamsCount: studentTeams.length,
      message: projectServers.length === 0 ? "No project servers found" : `Found ${projectServers.length} project servers via ${studentTeams.length} teams`
    });

  } catch (err) {
    logWithTimestamp('error', 'Error fetching student servers', {
      error: err.message,
      userId: req.user?.id
    });

    res.status(500).json({ 
      message: "Failed to fetch project servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Join project server (Optional - for students)
router.post("/join", verifyToken, async (req, res) => {
  try {
    logWithTimestamp('info', 'Student attempting to join server', {
      studentId: req.user.id,
      code: req.body.code
    });

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

    // Add to joined servers (optional)
    student.joinedServers.push(projectServer._id);
    await student.save();

    logWithTimestamp('info', 'Student joined server successfully', {
      studentId: req.user.id,
      serverCode: normalizedCode
    });

    res.json({
      message: "Successfully joined project server (optional step)",
      success: true,
      server: {
        _id: projectServer._id,
        title: projectServer.title,
        description: projectServer.description,
        code: projectServer.code,
        faculty: projectServer.faculty
      },
      info: "You can now create teams for this server"
    });

  } catch (err) {
    logWithTimestamp('error', 'Error joining server', {
      error: err.message,
      userId: req.user?.id
    });

    res.status(500).json({ 
      message: "Failed to join server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get project server details WITH TEAMS AND TASKS
router.get("/:serverId", verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    logWithTimestamp('info', 'Getting server details', {
      serverId,
      userId: req.user.id,
      userRole: req.user.role
    });

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
      hasAccess = projectServer.faculty._id.toString() === req.user.id;
    } else {
      // Students can access servers if they're in a team for that server
      const studentTeam = await StudentTeam.findOne({
        members: req.user.id,
        projectServer: projectServer.code
      });
      hasAccess = !!studentTeam;
    }

    if (!hasAccess) {
      return res.status(403).json({ 
        message: req.user.role === 'faculty' 
          ? "You can only access your own project servers"
          : "Create or join a team to access this server",
        success: false 
      });
    }

    // Get teams for this server
    const teams = await StudentTeam.find({ 
      projectServer: projectServer.code 
    }).populate('members', 'firstName lastName email');

    // Get tasks for this server
    const tasks = await Task.find({ 
      server: serverId 
    }).populate('team', 'name').populate('faculty', 'firstName lastName');

    logWithTimestamp('info', 'Server details loaded', {
      serverId,
      serverCode: projectServer.code,
      teamsCount: teams.length,
      tasksCount: tasks.length
    });

    const serverWithDetails = {
      ...projectServer.toObject(),
      teams: teams,
      tasks: tasks,
      stats: {
        teamsCount: teams.length,
        tasksCount: tasks.length,
        studentsCount: new Set(teams.flatMap(team => team.members.map(m => m._id.toString()))).size
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

    logWithTimestamp('info', 'Project server updated', {
      serverId,
      facultyId: req.user.id
    });

    res.json({
      success: true,
      message: "Project server updated successfully",
      server: updatedServer
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

// ✅ Delete project server (Faculty only)
router.delete("/:serverId", verifyToken, async (req, res) => {
  try {
    logWithTimestamp('info', 'Faculty attempting to delete server', {
      serverId: req.params.serverId,
      facultyId: req.user.id
    });

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

    logWithTimestamp('info', 'Project server deleted successfully', {
      serverId,
      facultyId: req.user.id
    });

    res.json({
      success: true,
      message: "Project server deleted successfully"
    });

  } catch (err) {
    logWithTimestamp('error', 'Error deleting project server', {
      error: err.message,
      serverId: req.params.serverId
    });

    res.status(500).json({ 
      message: "Failed to delete project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Project server routes are working',
    timestamp: new Date().toISOString(),
    routes: [
      'POST /api/projectServers/create',
      'GET /api/projectServers/faculty-servers',
      'GET /api/projectServers/student-servers',
      'POST /api/projectServers/join',
      'GET /api/projectServers/:serverId',
      'PUT /api/projectServers/:serverId',
      'DELETE /api/projectServers/:serverId'
    ]
  });
});

module.exports = router;