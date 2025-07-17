const express = require("express");
const router = express.Router();
const ProjectServer = require("../models/projectServerSchema");
const Student = require("../models/studentSchema");
const StudentTeam = require("../models/studentTeamSchema");
const Task = require("../models/taskSchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 projectServerRoutes.js loaded");

// ✅ Create project server (Faculty only) - FIXED CODE GENERATION
router.post("/create", verifyToken, async (req, res) => {
  try {
    console.log("📝 Create server request received from faculty:", req.user.id);
    console.log("📝 Request body:", req.body);

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

    // ENHANCED: Generate unique server code with better logic
    const generateUniqueCode = async () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let attempts = 0;
      const maxAttempts = 20;

      while (attempts < maxAttempts) {
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        console.log(`🔄 Attempting code generation: ${code} (attempt ${attempts + 1})`);
        
        // Check if code already exists
        const existingServer = await ProjectServer.findOne({ code: code });
        if (!existingServer) {
          console.log(`✅ Generated unique code: ${code}`);
          return code;
        }
        
        console.log(`❌ Code ${code} already exists, trying again...`);
        attempts++;
      }
      
      throw new Error("Failed to generate unique server code after multiple attempts");
    };

    let serverCode;
    try {
      serverCode = await generateUniqueCode();
    } catch (error) {
      console.error("❌ Code generation failed:", error);
      return res.status(500).json({ 
        message: "Failed to generate unique server code. Please try again.",
        success: false 
      });
    }

    console.log(`🎯 Creating project server with code: ${serverCode}`);

    const projectServer = new ProjectServer({
      title: title.trim(),
      description: description ? description.trim() : "",
      code: serverCode,
      faculty: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    });

    const savedServer = await projectServer.save();
    console.log(`✅ Server saved successfully with ID: ${savedServer._id}`);

    // Populate faculty details for response
    await savedServer.populate('faculty', 'firstName lastName email');

    console.log(`✅ Project server created: "${savedServer.title}" (${savedServer.code}) by faculty ${req.user.id}`);

    res.status(201).json({
      message: "Project server created successfully",
      success: true,
      server: {
        _id: savedServer._id,
        title: savedServer.title,
        description: savedServer.description,
        code: savedServer.code,
        faculty: savedServer.faculty,
        createdAt: savedServer.createdAt,
        updatedAt: savedServer.updatedAt,
        isActive: savedServer.isActive,
        teams: [], // Empty initially
        stats: {
          teamsCount: 0,
          tasksCount: 0,
          studentsCount: 0
        }
      }
    });

  } catch (err) {
    console.error("❌ Error creating project server:", err);
    res.status(500).json({ 
      message: "Failed to create project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get faculty's project servers WITH TEAMS AND STATS
// ✅ FIXED: Get faculty's project servers WITH TEAMS AND STATS
router.get("/faculty-servers", verifyToken, async (req, res) => {
  try {
    console.log(`📊 Faculty ${req.user.id} requesting their servers`);

    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can access this endpoint",
        success: false 
      });
    }

    const projectServers = await ProjectServer.find({ faculty: req.user.id })
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    console.log(`📊 Found ${projectServers.length} servers for faculty ${req.user.id}`);

    // Add teams and statistics for each server
    const serversWithDetails = await Promise.all(
      projectServers.map(async (server) => {
        console.log(`📊 Processing server: ${server.title} (${server.code})`);
        
        // ✅ FIXED: Get teams using server.code (not server._id)
        const teams = await StudentTeam.find({ 
          projectServer: server.code  // Use the server CODE, not _id
        }).populate('members', '_id firstName lastName email')
          .populate('creator', 'firstName lastName email');
        
        console.log(`📊 Found ${teams.length} teams for server ${server.code}`);
        
        // Get tasks for this server (tasks use server._id)
        const tasksCount = await Task.countDocuments({ 
          server: server._id 
        });
        
        console.log(`📊 Found ${tasksCount} tasks for server ${server._id}`);
        
        // Calculate unique students from teams
        const uniqueStudents = new Set();
        teams.forEach(team => {
          team.members.forEach(member => {
            uniqueStudents.add(member._id.toString());
          });
        });
        
        const serverObj = server.toObject();
        
        // ✅ FIXED: Add complete team data with all details
        serverObj.teams = teams.map(team => ({
          _id: team._id,
          name: team.name,
          members: team.members,
          creator: team.creator,
          createdAt: team.createdAt,
          projectServer: team.projectServer,
          description: team.description || ''
        }));
        
        // Add statistics
        serverObj.stats = {
          teamsCount: teams.length,
          tasksCount,
          studentsCount: uniqueStudents.size,
          lastActivity: teams.length > 0 
            ? Math.max(...teams.map(t => new Date(t.createdAt).getTime())) 
            : server.updatedAt
        };
        
        console.log(`📊 Server ${server.code} stats: ${teams.length} teams, ${tasksCount} tasks, ${uniqueStudents.size} students`);
        
        return serverObj;
      })
    );

    console.log(`✅ Returning ${serversWithDetails.length} servers with complete details`);

    res.status(200).json({
      success: true,
      servers: serversWithDetails,
      message: projectServers.length === 0 ? "No project servers found" : `Found ${projectServers.length} project servers`
    });

  } catch (err) {
    console.error("❌ Error fetching faculty servers:", err);
    res.status(500).json({ 
      message: "Failed to fetch project servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});
// ✅ Get student's project servers (based on team membership)
// ✅ FIXED: Get student's project servers (based on team membership)
router.get("/student-servers", verifyToken, async (req, res) => {
  try {
    console.log(`📊 Student ${req.user.id} requesting their servers via teams`);

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

    console.log(`📊 Student ${req.user.id} is in ${studentTeams.length} teams`);

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
    console.log(`📊 Server codes from teams:`, serverCodes);
    
    // Get server details
    const projectServers = await ProjectServer.find({ 
      code: { $in: serverCodes } 
    })
    .populate('faculty', 'firstName lastName email')
    .sort({ createdAt: -1 });

    console.log(`📊 Found ${projectServers.length} servers for codes:`, serverCodes);

    // ✅ FIXED: Add complete team information to each server
    const serversWithTeams = projectServers.map(server => {
      const serverObj = server.toObject();
      
      // Get teams for this specific server
      const serverTeams = studentTeams.filter(team => team.projectServer === server.code);
      
      serverObj.studentTeams = serverTeams.map(team => ({
        id: team._id,
        _id: team._id,  // Include both for compatibility
        name: team.name,
        members: team.members,
        creator: team.creator,
        createdAt: team.createdAt,
        description: team.description || ''
      }));
      
      return serverObj;
    });

    console.log(`✅ Returning ${projectServers.length} servers with team info`);

    res.status(200).json({
      success: true,
      servers: serversWithTeams,
      teamsCount: studentTeams.length,
      message: projectServers.length === 0 ? "No project servers found" : `Found ${projectServers.length} project servers via ${studentTeams.length} teams`
    });

  } catch (err) {
    console.error("❌ Error fetching student servers:", err);
    res.status(500).json({ 
      message: "Failed to fetch project servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Join project server (Optional - for students who want to)
router.post("/join", verifyToken, async (req, res) => {
  try {
    console.log(`🔗 Student ${req.user.id} attempting to join server with code: ${req.body.code}`);

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
    console.log(`🔍 Looking for server with code: ${normalizedCode}`);

    const projectServer = await ProjectServer.findOne({ code: normalizedCode })
      .populate('faculty', 'firstName lastName email');

    if (!projectServer) {
      console.log(`❌ No server found with code: ${normalizedCode}`);
      return res.status(404).json({ 
        message: "Invalid server code. Please check and try again.",
        success: false 
      });
    }

    console.log(`✅ Found server: ${projectServer.title} (${projectServer.code})`);

    // Check if already joined
    const student = await Student.findById(req.user.id);
    if (student.joinedServers.includes(projectServer._id)) {
      console.log(`ℹ️ Student ${req.user.id} already joined server ${normalizedCode}`);
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

    console.log(`✅ Student ${req.user.id} joined server ${normalizedCode}`);

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
    console.error("❌ Error joining server:", err);
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
    console.log(`📊 Getting details for server: ${serverId} by ${req.user.role} ${req.user.id}`);

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

    console.log(`📊 Server ${projectServer.code}: ${teams.length} teams, ${tasks.length} tasks`);

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

    console.log(`✅ Server details loaded successfully`);

    res.json({
      success: true,
      server: serverWithDetails
    });

  } catch (err) {
    console.error("❌ Error fetching server details:", err);
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
    console.error("❌ Error updating project server:", err);
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
    console.log(`🗑️ Faculty ${req.user.id} attempting to delete server: ${req.params.serverId}`);

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

    console.log(`📊 Server deletion check: ${teamsCount} teams, ${tasksCount} tasks`);

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

    console.log(`✅ Project server ${serverId} deleted successfully`);

    res.json({
      success: true,
      message: "Project server deleted successfully"
    });

  } catch (err) {
    console.error("❌ Error deleting project server:", err);
    res.status(500).json({ 
      message: "Failed to delete project server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ DEBUG: Test server code generation
router.get("/debug/test-code", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ message: "Faculty only" });
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let testCode = '';
    for (let i = 0; i < 6; i++) {
      testCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const existing = await ProjectServer.findOne({ code: testCode });
    const allCodes = await ProjectServer.find({}, 'code title');

    res.json({
      testCode,
      exists: !!existing,
      totalServers: allCodes.length,
      allCodes: allCodes.map(s => s.code)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;