const express = require("express");
const router = express.Router();
const Student = require("../models/studentSchema");
const ProjectServer = require("../models/projectServerSchema");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const { jwtSecret, jwtExpiresIn } = require("../config/jwt");
const verifyToken = require("../middleware/verifyToken");

// Dashboard route - Enhanced to return proper student data
router.get("/dashboard", verifyToken, async (req, res) => {
    try {
        // Verify this is a student user
        if (req.user.role !== "student") {
            return res.status(403).json({ 
                message: "Access denied. Student access required.",
                success: false 
            });
        }

        // Get student details from database
        const student = await Student.findById(req.user.id)
            .select('-password')
            .populate('joinedTeams')
            .populate('joinedServers');
        
        if (!student) {
            return res.status(404).json({ 
                message: "Student not found",
                success: false 
            });
        }

        res.status(200).json({ 
            success: true,
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            username: student.username,
            role: "student",
            joinedTeams: student.joinedTeams || [],
            joinedServers: student.joinedServers || [],
            message: `Welcome, ${student.firstName}!`
        });
    } catch (err) {
        console.error("Dashboard error:", err);
        res.status(500).json({ 
            message: "Server error",
            error: err.message,
            success: false 
        });
    }
});

// Login (COOKIE-based)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
        return res.status(400).json({ 
            message: "Username and password are required",
            success: false 
        });
    }

    const student = await Student.findOne({ username });
    if (!student) {
        return res.status(404).json({ 
            message: "Invalid username or password",
            success: false 
        });
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
        return res.status(401).json({ 
            message: "Invalid username or password",
            success: false 
        });
    }

    const token = jwt.sign(
        { 
            id: student._id, 
            role: "student",
            username: student.username 
        }, 
        jwtSecret, 
        { expiresIn: jwtExpiresIn }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in production
      sameSite: "Lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.status(200).json({
      message: "Login successful",
      success: true,
      student: {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        username: student.username,
        role: "student"
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
        message: "Login failed", 
        error: err.message,
        success: false 
    });
  }
});

// ✅ Join Project Server - NEW ENDPOINT
router.post("/joinServer", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can join project servers",
        success: false 
      });
    }

    const { serverCode } = req.body;

    if (!serverCode || serverCode.trim().length === 0) {
      return res.status(400).json({ 
        message: "Server code is required",
        success: false 
      });
    }

    // Find the project server
    const projectServer = await ProjectServer.findOne({ code: serverCode.trim() })
      .populate("faculty", "firstName lastName email");

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Invalid server code. Please check and try again.",
        success: false 
      });
    }

    // Get the student
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    // Check if student already joined this server
    const alreadyJoined = student.joinedServers.some(
      serverId => serverId.toString() === projectServer._id.toString()
    );

    if (alreadyJoined) {
      return res.status(400).json({ 
        message: "You have already joined this project server",
        success: false 
      });
    }

    // Add server to student's joined servers
    student.joinedServers.push(projectServer._id);
    await student.save();

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
    console.error("Error joining server:", err);
    res.status(500).json({ 
      message: "Failed to join server", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Get joined servers for student
router.get("/joinedServers", verifyToken, async (req, res) => {
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
    console.error("Error fetching joined servers:", err);
    res.status(500).json({ 
      message: "Failed to fetch joined servers", 
      error: err.message,
      success: false 
    });
  }
});

// Logout
router.post("/logout", (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "Lax"
        });
        res.status(200).json({ 
            message: "Logout successful",
            success: true 
        });
    } catch (err) {
        console.error("Logout error:", err);
        res.status(500).json({ 
            message: "Logout failed", 
            error: err.message,
            success: false 
        });
    }
});

// Create student
router.post("/createStudent", async (req, res) => {
    try {
        const { firstName, lastName, email, phone, username, password } = req.body;
        
        // Input validation
        if (!firstName || !lastName || !email || !username || !password) {
            return res.status(400).json({ 
                message: 'All fields are required',
                success: false 
            });
        }

        // Check if the user already exists
        const existingUser = await Student.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                message: existingUser.email === email ? 
                    'Email already exists' : 'Username already exists',
                success: false 
            });
        }
 
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create a new student user
        const newStudent = new Student({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone?.trim(),
            username: username.trim(),
            password: hashedPassword
        });
        
        console.log("Creating new student:", { 
            firstName, lastName, email, username 
        });
        
        await newStudent.save();
        
        res.status(201).json({ 
            message: 'Student registered successfully',
            success: true 
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message,
            success: false 
        });
    }
});

// Get all students
router.get("/getAllStudents", verifyToken, async (req, res) => {
    try {
        const students = await Student.find()
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            students
        });
    } catch (err) {
        console.error("Error fetching students:", err);
        res.status(500).json({ 
            message: "Error fetching students", 
            error: err.message,
            success: false 
        });
    }
});

module.exports = router;