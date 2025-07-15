const express = require("express");
const router = express.Router();
const ProjectServer = require("../models/projectServerSchema");
const Student = require("../models/studentSchema");
const Faculty = require("../models/facultySchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 projectServerRoutes.js loaded");

// Test route
router.get("/test", (req, res) => {
  console.log("✅ Test route hit");
  res.json({ message: "Project server routes working!", timestamp: new Date() });
});

// ✅ Enhanced join endpoint with better validation and UX
router.post("/join", verifyToken, async (req, res) => {
  console.log("🎯 JOIN route hit");
  console.log("User:", req.user);
  console.log("Body:", req.body);
  
  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ 
        message: "Authentication required",
        success: false 
      });
    }

    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can join project servers",
        success: false 
      });
    }

    // ✅ Accept 'code' from frontend
    const { code } = req.body;
    
    if (!code || code.trim().length === 0) {
      return res.status(400).json({ 
        message: "Server code is required",
        success: false
      });
    }

    if (code.trim().length < 3) {
      return res.status(400).json({ 
        message: "Server code must be at least 3 characters",
        success: false
      });
    }

    // Find the project server
    console.log("🔍 Looking for server with code:", code.trim().toUpperCase());
    const projectServer = await ProjectServer.findOne({ 
      code: code.trim().toUpperCase() 
    }).populate("faculty", "firstName lastName email");

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Invalid server code. Please check and try again.",
        success: false
      });
    }

    // Check if student is already a member
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false
      });
    }

    const isAlreadyMember = student.joinedServers.some(serverId => 
      serverId.toString() === projectServer._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({ 
        message: "You are already a member of this project server",
        success: false
      });
    }

    // Add student to the project server
    student.joinedServers.push(projectServer._id);
    await student.save();

    console.log(`✅ Student ${student.username} joined server ${projectServer.code}`);

    res.status(200).json({ 
      message: `Successfully joined "${projectServer.title}"!`,
      success: true,
      server: {
        _id: projectServer._id,
        title: projectServer.title,
        description: projectServer.description,
        code: projectServer.code,
        faculty: projectServer.faculty,
        createdAt: projectServer.createdAt
      }
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

// ✅ Enhanced server creation with better code generation
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

    // ✅ Enhanced code generation
    const generateCode = () => {
      // Extract first 3 letters from title, fallback to random letters
      let prefix = title.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
      if (prefix.length < 3) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        while (prefix.length < 3) {
          prefix += letters.charAt(Math.floor(Math.random() * letters.length));
        }
      }
      const random = Math.floor(Math.random() * 900) + 100; // 100-999
      return `${prefix}${random}`;
    };

    let code = generateCode();
    let attempts = 0;
    
    // Ensure unique code
    while (attempts < 10) {
      const existing = await ProjectServer.findOne({ code });
      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    if (attempts >= 10) {
      return res.status(500).json({ 
        message: "Failed to generate unique server code. Please try again.",
        success: false 
      });
    }

    const projectServer = new ProjectServer({
      title: title.trim(),
      description: description?.trim() || "",
      code,
      faculty: req.user.id
    });

    await projectServer.save();

    // Add to faculty's project servers
    await Faculty.findByIdAndUpdate(
      req.user.id,
      { $push: { projectServers: projectServer._id } }
    );

    console.log(`✅ Project server "${title.trim()}" created with code ${code}`);

    res.status(201).json({
      message: "Project server created successfully",
      success: true,
      server: {
        _id: projectServer._id,
        title: projectServer.title,
        description: projectServer.description,
        code: projectServer.code,
        faculty: req.user.id,
        createdAt: projectServer.createdAt,
        studentCount: 0
      }
    });

  } catch (err) {
    console.error("Error creating server:", err);
    res.status(500).json({ 
      message: "Failed to create server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get servers for a student
router.get("/student-servers", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Access denied. Student access required.",
        success: false 
      });
    }

    const student = await Student.findById(req.user.id)
      .populate({
        path: 'joinedServers',
        populate: {
          path: 'faculty',
          select: 'firstName lastName email'
        }
      });

    if (!student) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    const servers = student.joinedServers || [];

    console.log(`Student ${req.user.id} has ${servers.length} servers`);

    res.status(200).json({
      success: true,
      servers,
      message: servers.length === 0 ? "No servers joined yet. Join a server using a server code." : `You are member of ${servers.length} servers`
    });
  } catch (err) {
    console.error("Error fetching student servers:", err);
    res.status(500).json({ 
      message: "Failed to fetch servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get servers for faculty
router.get("/faculty-servers", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Access denied. Faculty access required.",
        success: false 
      });
    }

    const servers = await ProjectServer.find({ faculty: req.user.id })
      .populate("faculty", "firstName lastName email")
      .sort({ createdAt: -1 });

    // ✅ Add student count for each server
    const serversWithCounts = await Promise.all(servers.map(async (server) => {
      const studentCount = await Student.countDocuments({ 
        joinedServers: server._id 
      });
      
      return {
        ...server.toObject(),
        studentCount
      };
    }));

    console.log(`Faculty ${req.user.id} has ${servers.length} servers`);

    res.status(200).json({
      success: true,
      servers: serversWithCounts,
      message: servers.length === 0 ? "No project servers created yet. Create your first server to get started." : `You have ${servers.length} project servers`
    });
  } catch (err) {
    console.error("Error fetching faculty servers:", err);
    res.status(500).json({ 
      message: "Failed to fetch servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get server details
router.get("/:serverId", verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await ProjectServer.findById(serverId)
      .populate("faculty", "firstName lastName email");

    if (!server) {
      return res.status(404).json({ 
        message: "Server not found",
        success: false 
      });
    }

    // Check access permissions
    const isOwner = req.user.role === "faculty" && server.faculty._id.toString() === req.user.id;
    const isMember = req.user.role === "student" && await Student.findOne({
      _id: req.user.id,
      joinedServers: serverId
    });

    if (!isOwner && !isMember) {
      return res.status(403).json({ 
        message: "Access denied. You must be a member or owner of this server.",
        success: false 
      });
    }

    // Get student count and members (if owner)
    const studentCount = await Student.countDocuments({ 
      joinedServers: serverId 
    });

    let members = [];
    if (isOwner) {
      members = await Student.find({ 
        joinedServers: serverId 
      }).select('firstName lastName email username');
    }

    res.status(200).json({
      success: true,
      server: {
        ...server.toObject(),
        studentCount,
        members: isOwner ? members : undefined
      }
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

// ✅ Update server (faculty only)
router.put("/:serverId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can update project servers",
        success: false 
      });
    }

    const { serverId } = req.params;
    const { title, description } = req.body;

    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: "Server not found",
        success: false 
      });
    }

    // Check ownership
    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only update your own project servers",
        success: false 
      });
    }

    // Validate input
    if (title && title.trim().length < 3) {
      return res.status(400).json({ 
        message: "Project title must be at least 3 characters long",
        success: false 
      });
    }

    // Update server
    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();

    const updatedServer = await ProjectServer.findByIdAndUpdate(
      serverId,
      updateData,
      { new: true }
    ).populate("faculty", "firstName lastName email");

    res.status(200).json({
      message: "Server updated successfully",
      success: true,
      server: updatedServer
    });
  } catch (err) {
    console.error("Error updating server:", err);
    res.status(500).json({ 
      message: "Failed to update server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Delete server (faculty only)
router.delete("/:serverId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can delete project servers",
        success: false 
      });
    }

    const { serverId } = req.params;

    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: "Server not found",
        success: false 
      });
    }

    // Check ownership
    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only delete your own project servers",
        success: false 
      });
    }

    // Remove server from all students' joinedServers
    await Student.updateMany(
      { joinedServers: serverId },
      { $pull: { joinedServers: serverId } }
    );

    // Remove server from faculty's projectServers
    await Faculty.findByIdAndUpdate(
      req.user.id,
      { $pull: { projectServers: serverId } }
    );

    // Delete the server
    await ProjectServer.findByIdAndDelete(serverId);

    console.log(`✅ Project server ${server.code} deleted by faculty ${req.user.id}`);

    res.status(200).json({
      message: "Project server deleted successfully",
      success: true
    });
  } catch (err) {
    console.error("Error deleting server:", err);
    res.status(500).json({ 
      message: "Failed to delete server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Leave server (student only)
router.post("/leave/:serverId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can leave project servers",
        success: false 
      });
    }

    const { serverId } = req.params;

    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: "Server not found",
        success: false 
      });
    }

    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    // Check if student is a member
    const isMember = student.joinedServers.some(id => id.toString() === serverId);
    if (!isMember) {
      return res.status(400).json({ 
        message: "You are not a member of this project server",
        success: false 
      });
    }

    // Remove server from student's joinedServers
    student.joinedServers = student.joinedServers.filter(id => id.toString() !== serverId);
    await student.save();

    // Also remove student from any teams in this server
    const StudentTeam = require("../models/studentTeamSchema");
    await StudentTeam.updateMany(
      { projectServer: server.code, members: req.user.id },
      { $pull: { members: req.user.id } }
    );

    // Remove empty teams
    await StudentTeam.deleteMany({
      projectServer: server.code,
      members: { $size: 0 }
    });

    console.log(`✅ Student ${req.user.id} left server ${server.code}`);

    res.status(200).json({
      message: `Successfully left "${server.title}"`,
      success: true
    });
  } catch (err) {
    console.error("Error leaving server:", err);
    res.status(500).json({ 
      message: "Failed to leave server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get server statistics (faculty only)
router.get("/:serverId/stats", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can view server statistics",
        success: false 
      });
    }

    const { serverId } = req.params;

    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: "Server not found",
        success: false 
      });
    }

    // Check ownership
    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only view statistics for your own servers",
        success: false 
      });
    }

    // Get statistics
    const studentCount = await Student.countDocuments({ 
      joinedServers: serverId 
    });

    const StudentTeam = require("../models/studentTeamSchema");
    const teamCount = await StudentTeam.countDocuments({ 
      projectServer: server.code 
    });

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentJoins = await Student.countDocuments({
      joinedServers: serverId,
      updatedAt: { $gte: thirtyDaysAgo }
    });

    const recentTeams = await StudentTeam.countDocuments({
      projectServer: server.code,
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalStudents: studentCount,
        totalTeams: teamCount,
        recentJoins: recentJoins,
        recentTeams: recentTeams,
        serverAge: Math.floor((new Date() - new Date(server.createdAt)) / (1000 * 60 * 60 * 24)), // days
      }
    });
  } catch (err) {
    console.error("Error fetching server stats:", err);
    res.status(500).json({ 
      message: "Failed to fetch server statistics", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get server members (faculty only)
router.get("/:serverId/members", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can view server members",
        success: false 
      });
    }

    const { serverId } = req.params;

    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: "Server not found",
        success: false 
      });
    }

    // Check ownership
    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only view members of your own servers",
        success: false 
      });
    }

    // Get all students in this server
    const members = await Student.find({ 
      joinedServers: serverId 
    })
      .select('firstName lastName email username joinedAt')
      .sort({ joinedAt: -1 });

    res.status(200).json({
      success: true,
      members,
      count: members.length,
      server: {
        _id: server._id,
        title: server.title,
        code: server.code
      }
    });
  } catch (err) {
    console.error("Error fetching server members:", err);
    res.status(500).json({ 
      message: "Failed to fetch server members", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Remove student from server (faculty only)
router.post("/:serverId/remove-student", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can remove students from servers",
        success: false 
      });
    }

    const { serverId } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ 
        message: "Student ID is required",
        success: false 
      });
    }

    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: "Server not found",
        success: false 
      });
    }

    // Check ownership
    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only remove students from your own servers",
        success: false 
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    // Check if student is a member
    const isMember = student.joinedServers.some(id => id.toString() === serverId);
    if (!isMember) {
      return res.status(400).json({ 
        message: "Student is not a member of this server",
        success: false 
      });
    }

    // Remove server from student's joinedServers
    student.joinedServers = student.joinedServers.filter(id => id.toString() !== serverId);
    await student.save();

    // Remove student from any teams in this server
    const StudentTeam = require("../models/studentTeamSchema");
    await StudentTeam.updateMany(
      { projectServer: server.code, members: studentId },
      { $pull: { members: studentId } }
    );

    // Remove empty teams
    await StudentTeam.deleteMany({
      projectServer: server.code,
      members: { $size: 0 }
    });

    console.log(`✅ Faculty ${req.user.id} removed student ${studentId} from server ${server.code}`);

    res.status(200).json({
      message: `Student removed from "${server.title}" successfully`,
      success: true
    });
  } catch (err) {
    console.error("Error removing student from server:", err);
    res.status(500).json({ 
      message: "Failed to remove student from server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Regenerate server code (faculty only)
router.post("/:serverId/regenerate-code", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can regenerate server codes",
        success: false 
      });
    }

    const { serverId } = req.params;

    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ 
        message: "Server not found",
        success: false 
      });
    }

    // Check ownership
    if (server.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only regenerate codes for your own servers",
        success: false 
      });
    }

    // Generate new code
    const generateCode = () => {
      let prefix = server.title.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
      if (prefix.length < 3) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        while (prefix.length < 3) {
          prefix += letters.charAt(Math.floor(Math.random() * letters.length));
        }
      }
      const random = Math.floor(Math.random() * 900) + 100;
      return `${prefix}${random}`;
    };

    let newCode = generateCode();
    let attempts = 0;
    
    // Ensure unique code
    while (attempts < 10) {
      const existing = await ProjectServer.findOne({ code: newCode });
      if (!existing) break;
      newCode = generateCode();
      attempts++;
    }

    if (attempts >= 10) {
      return res.status(500).json({ 
        message: "Failed to generate unique code. Please try again.",
        success: false 
      });
    }

    // Update server code
    const oldCode = server.code;
    server.code = newCode;
    await server.save();

    // Update all teams in this server
    const StudentTeam = require("../models/studentTeamSchema");
    await StudentTeam.updateMany(
      { projectServer: oldCode },
      { projectServer: newCode }
    );

    console.log(`✅ Server code regenerated from ${oldCode} to ${newCode}`);

    res.status(200).json({
      message: "Server code regenerated successfully",
      success: true,
      oldCode,
      newCode,
      server: {
        _id: server._id,
        title: server.title,
        code: newCode
      }
    });
  } catch (err) {
    console.error("Error regenerating server code:", err);
    res.status(500).json({ 
      message: "Failed to regenerate server code", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

console.log("🔧 All project server routes defined successfully");

module.exports = router;