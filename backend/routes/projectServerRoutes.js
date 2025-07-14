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

// 🔥 FIXED: Join endpoint - now accepts 'code' instead of 'serverCode'
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

    // 🔥 FIXED: Accept 'code' from frontend
    const { code } = req.body;
    
    if (!code || code.trim().length === 0) {
      return res.status(400).json({ 
        message: "Server code is required",
        success: false
      });
    }

    // Find the project server
    console.log("🔍 Looking for server with code:", code.trim());
    const projectServer = await ProjectServer.findOne({ code: code.trim() })
      .populate("faculty", "firstName lastName email");

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Invalid server code. Please check and try again.",
        success: false 
      });
    }

    // Get the student
    console.log("🔍 Looking for student:", req.user.id);
    const student = await Student.findById(req.user.id);

    if (!student) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    // Check if student already joined this server
    const alreadyJoined = student.joinedServers && student.joinedServers.some(
      serverId => serverId.toString() === projectServer._id.toString()
    );

    if (alreadyJoined) {
      return res.status(400).json({ 
        message: "You have already joined this project server",
        success: false 
      });
    }

    // Add server to student's joined servers
    if (!student.joinedServers) {
      student.joinedServers = [];
    }
    student.joinedServers.push(projectServer._id);
    await student.save();

    console.log("✅ Successfully joined server");

    res.status(200).json({
      message: `Successfully joined "${projectServer.title}"`,
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
    console.error("❌ Error joining server:", err);
    res.status(500).json({ 
      message: "Failed to join server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// 🔥 NEW: Create Project Server (for Faculty)
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

    // Generate unique project code
    const generateCode = () => {
      const prefix = title.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
      const random = Math.floor(Math.random() * 900) + 100;
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
        message: "Failed to generate unique code",
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

    res.status(201).json({
      message: "Project server created successfully",
      success: true,
      server: {
        _id: projectServer._id,
        title: projectServer.title,
        description: projectServer.description,
        code: projectServer.code,
        faculty: req.user.id,
        createdAt: projectServer.createdAt
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

// Get student servers
router.get("/student-servers", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Access denied",
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

    res.status(200).json({
      success: true,
      servers: student.joinedServers || []
    });

  } catch (err) {
    console.error("Error fetching student servers:", err);
    res.status(500).json({ 
      message: "Failed to fetch joined servers", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// Get faculty servers
router.get("/faculty-servers", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    const servers = await ProjectServer.find({ faculty: req.user.id })
      .populate('faculty', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      servers
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

// Get server by code (public)
router.get("/byCode/:code", async (req, res) => {
  try {
    const server = await ProjectServer.findOne({ code: req.params.code })
      .populate('faculty', 'firstName lastName email');
    
    if (!server) {
      return res.status(404).json({ 
        message: "Server not found",
        success: false 
      });
    }
    
    res.json({ 
      success: true, 
      server: {
        _id: server._id,
        title: server.title,
        description: server.description,
        code: server.code,
        faculty: server.faculty,
        createdAt: server.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Error fetching server", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

console.log("🔧 All routes defined in projectServerRoutes.js");
module.exports = router;