const express = require("express");
const router = express.Router();
const ProjectServer = require("../models/projectServerSchema");
const Student = require("../models/studentSchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 projectServerRoutes.js loaded");

// Test route to verify routing works
router.get("/test", (req, res) => {
  console.log("✅ Test route hit");
  res.json({ message: "Project server routes working!", timestamp: new Date() });
});

// Join endpoint - with detailed logging
router.post("/join", verifyToken, async (req, res) => {
  console.log("🎯 JOIN route hit");
  console.log("Headers:", req.headers);
  console.log("User:", req.user);
  console.log("Body:", req.body);
  console.log("Body type:", typeof req.body);
  console.log("Raw body:", JSON.stringify(req.body));
  
  try {
    // Check if user exists
    if (!req.user) {
      console.log("❌ No user found - authentication failed");
      return res.status(401).json({ 
        message: "Authentication required",
        success: false 
      });
    }

    console.log("User role:", req.user.role);
    
    if (req.user.role !== "student") {
      console.log("❌ Access denied - not a student, role is:", req.user.role);
      return res.status(403).json({ 
        message: "Only students can join project servers",
        success: false,
        userRole: req.user.role
      });
    }

    const { serverCode } = req.body;
    console.log("Server code received:", serverCode);
    console.log("Server code type:", typeof serverCode);

    if (!serverCode || serverCode.trim().length === 0) {
      console.log("❌ No server code provided");
      return res.status(400).json({ 
        message: "Server code is required",
        success: false,
        receivedData: req.body
      });
    }

    // Find the project server
    console.log("🔍 Looking for server with code:", serverCode.trim());
    const projectServer = await ProjectServer.findOne({ code: serverCode.trim() })
      .populate("faculty", "firstName lastName email");

    console.log("Found server:", projectServer);

    if (!projectServer) {
      console.log("❌ Server not found");
      return res.status(404).json({ 
        message: "Invalid server code. Please check and try again.",
        success: false 
      });
    }

    // Get the student
    console.log("🔍 Looking for student:", req.user.id);
    const student = await Student.findById(req.user.id);
    console.log("Found student:", student ? "Yes" : "No");

    if (!student) {
      console.log("❌ Student not found");
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    // Check if student already joined this server
    const alreadyJoined = student.joinedServers && student.joinedServers.some(
      serverId => serverId.toString() === projectServer._id.toString()
    );

    console.log("Already joined:", alreadyJoined);

    if (alreadyJoined) {
      console.log("❌ Already joined");
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
        id: projectServer._id,
        title: projectServer.title,
        description: projectServer.description,
        code: projectServer.code,
        faculty: projectServer.faculty
      }
    });

  } catch (err) {
    console.error("❌ Error joining server:", err);
    res.status(500).json({ 
      message: "Failed to join server", 
      error: err.message,
      success: false 
    });
  }
});

// Get student servers
router.get("/student-servers", verifyToken, async (req, res) => {
  console.log("📋 GET student-servers route hit");
  
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
      error: err.message,
      success: false 
    });
  }
});

// Simple route to get server by code
router.get("/byCode/:code", async (req, res) => {
  try {
    const server = await ProjectServer.findOne({ code: req.params.code });
    if (!server) {
      return res.status(404).json({ message: "Server not found" });
    }
    res.json({ success: true, server });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});

console.log("🔧 All routes defined in projectServerRoutes.js");

module.exports = router;