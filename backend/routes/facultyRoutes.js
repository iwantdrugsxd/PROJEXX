const express = require("express");
const router = express.Router();
const Faculty = require("../models/facultySchema.js");

const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const { jwtSecret, jwtExpiresIn } = require("../config/jwt");
const verifyToken = require("../middleware/verifyToken");

router.get("/dashboard", verifyToken, (req, res) => {
    try {
        res.json({ message: `Hello, ${req.user.role}!`, userId: req.user.id });
    } catch(err) {
        console.log(err);
    }
});

// Login (COOKIE-based)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const faculty = await Faculty.findOne({ username });
    if (!faculty) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, faculty.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ id: faculty._id, role: faculty.role }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // Set to true in production (HTTPS)
      sameSite: "Lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.status(200).json({
      message: "Login successful",
      faculty: {
        id: faculty._id,
        name: faculty.firstName + " " + faculty.lastName,
        email: faculty.email,
        firstName: faculty.firstName,
        lastName: faculty.lastName,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// ✅ FIXED: Logout with proper cookie clearing
router.post("/logout", (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            path: '/' // Ensure correct path
        });
        
        console.log("✅ Faculty logged out successfully");
        
        res.status(200).json({ 
            message: "Logout successful",
            success: true 
        });
    } catch(err) {
        console.error("Faculty logout error:", err);
        res.status(500).json({ 
            message: "Logout failed", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Create faculty
router.post("/createFaculty", async (req, res) => {
    try {
        const { firstName, lastName, email, username, password } = req.body;

        // Check if faculty already exists
        const existingFaculty = await Faculty.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingFaculty) {
            return res.status(400).json({ 
                message: "Faculty with this email or username already exists",
                success: false 
            });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new faculty
        const newFaculty = new Faculty({
            firstName,
            lastName,
            email,
            username,
            password: hashedPassword,
            role: "faculty"
        });

        await newFaculty.save();

        res.status(201).json({
            message: "Faculty created successfully",
            success: true,
            faculty: {
                id: newFaculty._id,
                firstName: newFaculty.firstName,
                lastName: newFaculty.lastName,
                email: newFaculty.email,
                username: newFaculty.username
            }
        });
    } catch (err) {
        console.error("Error creating faculty:", err);
        res.status(500).json({ 
            message: "Failed to create faculty", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Get faculty profile
router.get("/profile", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "faculty") {
            return res.status(403).json({ 
                message: "Access denied",
                success: false 
            });
        }

        const faculty = await Faculty.findById(req.user.id)
            .select('-password')
            .populate('projectServers');

        if (!faculty) {
            return res.status(404).json({ 
                message: "Faculty not found",
                success: false 
            });
        }

        res.status(200).json({
            success: true,
            faculty
        });
    } catch (err) {
        console.error("Error fetching faculty profile:", err);
        res.status(500).json({ 
            message: "Failed to fetch profile", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Update faculty profile
router.put("/profile", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "faculty") {
            return res.status(403).json({ 
                message: "Access denied",
                success: false 
            });
        }

        const { firstName, lastName, email } = req.body;

        const faculty = await Faculty.findByIdAndUpdate(
            req.user.id,
            { firstName, lastName, email },
            { new: true }
        ).select('-password');

        if (!faculty) {
            return res.status(404).json({ 
                message: "Faculty not found",
                success: false 
            });
        }

        res.status(200).json({
            message: "Profile updated successfully",
            success: true,
            faculty
        });
    } catch (err) {
        console.error("Error updating faculty profile:", err);
        res.status(500).json({ 
            message: "Failed to update profile", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

console.log("🔧 Faculty routes loaded successfully");

module.exports = router;