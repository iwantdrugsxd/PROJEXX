const express = require("express");
const router = express.Router();
const Student = require("../models/studentSchema");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const { jwtSecret, jwtExpiresIn } = require("../config/jwt");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 studentRoutes.js loaded");

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
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            username: student.username,
            role: "student",
            joinedTeams: student.joinedTeams || [],
            joinedServers: student.joinedServers || [],
            profile: student.profile || {},
            performance: student.performance || {},
            message: `Welcome, ${student.firstName}!`
        });
    } catch (err) {
        console.error("Dashboard error:", err);
        res.status(500).json({ 
            message: "Server error",
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
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

        // Find student by username or email
        const student = await Student.findOne({ 
            $or: [{ username }, { email: username }] 
        });

        if (!student) {
            return res.status(404).json({ 
                message: "Invalid username or password",
                success: false 
            });
        }

        // Check if account is active
        if (!student.isActive) {
            return res.status(401).json({ 
                message: "Account is disabled. Please contact administrator.",
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

        // Update last login
        student.lastLogin = new Date();
        await student.save();

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
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
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
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Register
router.post("/register", async (req, res) => {
    try {
        const { firstName, lastName, email, phone, username, password } = req.body;

        // Input validation
        if (!firstName || !lastName || !email || !username || !password) {
            return res.status(400).json({ 
                message: "All required fields must be filled",
                success: false,
                required: ['firstName', 'lastName', 'email', 'username', 'password']
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: "Please enter a valid email address",
                success: false 
            });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({ 
                message: "Password must be at least 6 characters long",
                success: false 
            });
        }

        // Check if student already exists
        const existingStudent = await Student.findOne({ 
            $or: [
                { email: email.toLowerCase() }, 
                { username: username.toLowerCase() }
            ] 
        });

        if (existingStudent) {
            const field = existingStudent.email === email.toLowerCase() ? 'email' : 'username';
            return res.status(400).json({ 
                message: `Student with this ${field} already exists`,
                success: false 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new student
        const newStudent = new Student({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone?.trim() || "",
            username: username.toLowerCase().trim(),
            password: hashedPassword,
            isActive: true,
            lastLogin: new Date()
        });

        await newStudent.save();

        console.log("✅ New student registered:", newStudent.username);

        res.status(201).json({
            message: "Student registered successfully",
            success: true,
            student: {
                id: newStudent._id,
                firstName: newStudent.firstName,
                lastName: newStudent.lastName,
                email: newStudent.email,
                username: newStudent.username,
                role: "student"
            }
        });

    } catch (err) {
        console.error("Registration error:", err);
        
        // Handle duplicate key errors
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(400).json({ 
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
                success: false 
            });
        }
        
        // Handle validation errors
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ 
                message: messages.join(', '),
                success: false 
            });
        }
        
        res.status(500).json({ 
            message: "Registration failed", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Update Profile
router.put("/profile", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({ 
                message: "Access denied",
                success: false 
            });
        }

        const { firstName, lastName, phone, bio, skills, interests } = req.body;
        
        const updateData = {};
        if (firstName && firstName.trim()) updateData.firstName = firstName.trim();
        if (lastName && lastName.trim()) updateData.lastName = lastName.trim();
        if (phone !== undefined) updateData.phone = phone.trim();
        if (bio !== undefined) updateData['profile.bio'] = bio.trim();
        if (Array.isArray(skills)) updateData['profile.skills'] = skills;
        if (Array.isArray(interests)) updateData['profile.interests'] = interests;

        const updatedStudent = await Student.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedStudent) {
            return res.status(404).json({ 
                message: "Student not found",
                success: false 
            });
        }

        res.status(200).json({
            message: "Profile updated successfully",
            success: true,
            student: updatedStudent
        });

    } catch (err) {
        console.error("Profile update error:", err);
        res.status(500).json({ 
            message: "Failed to update profile", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Get Student Profile
router.get("/profile", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({ 
                message: "Access denied",
                success: false 
            });
        }

        const student = await Student.findById(req.user.id)
            .select('-password')
            .populate('joinedTeams')
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
            student
        });

    } catch (err) {
        console.error("Error fetching student profile:", err);
        res.status(500).json({ 
            message: "Failed to fetch profile", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Change Password
router.put("/change-password", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({ 
                message: "Access denied",
                success: false 
            });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                message: "Current password and new password are required",
                success: false 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                message: "New password must be at least 6 characters long",
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

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, student.password);
        if (!isMatch) {
            return res.status(400).json({ 
                message: "Current password is incorrect",
                success: false 
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await Student.findByIdAndUpdate(req.user.id, { password: hashedPassword });

        console.log("✅ Password changed for student:", student.username);

        res.status(200).json({
            message: "Password changed successfully",
            success: true
        });

    } catch (err) {
        console.error("Change password error:", err);
        res.status(500).json({ 
            message: "Failed to change password", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Get Student Stats (for dashboard)
router.get("/stats", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({ 
                message: "Access denied",
                success: false 
            });
        }

        const student = await Student.findById(req.user.id)
            .populate('joinedTeams')
            .populate('joinedServers');

        if (!student) {
            return res.status(404).json({ 
                message: "Student not found",
                success: false 
            });
        }

        const stats = {
            serversJoined: student.joinedServers?.length || 0,
            teamsJoined: student.joinedTeams?.length || 0,
            totalTasks: student.performance?.totalTasks || 0,
            completedTasks: student.performance?.completedTasks || 0,
            averageScore: student.performance?.averageScore || 0,
            completionRate: student.performance.totalTasks > 0 
                ? Math.round((student.performance.completedTasks / student.performance.totalTasks) * 100)
                : 0
        };

        res.status(200).json({
            success: true,
            stats
        });

    } catch (err) {
        console.error("Error fetching student stats:", err);
        res.status(500).json({ 
            message: "Failed to fetch stats", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Leave Server
router.post("/leave-server", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({ 
                message: "Access denied",
                success: false 
            });
        }

        const { serverId } = req.body;

        if (!serverId) {
            return res.status(400).json({ 
                message: "Server ID is required",
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

        // Check if student is in the server
        const serverIndex = student.joinedServers.findIndex(
            id => id.toString() === serverId
        );

        if (serverIndex === -1) {
            return res.status(400).json({ 
                message: "You are not a member of this server",
                success: false 
            });
        }

        // Remove server from student's joined servers
        student.joinedServers.splice(serverIndex, 1);
        await student.save();

        res.status(200).json({
            message: "Successfully left the server",
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

// Logout
router.post("/logout", (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax'
        });
        
        console.log("✅ Student logged out successfully");
        
        res.status(200).json({ 
            message: "Logged out successfully",
            success: true 
        });
    } catch (err) {
        console.error("Logout error:", err);
        res.status(500).json({ 
            message: "Logout failed", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Get All Students (for admin/faculty use - if needed)
router.get("/all", verifyToken, async (req, res) => {
    try {
        // Only allow faculty or admin to access this
        if (req.user.role !== "faculty" && req.user.role !== "admin") {
            return res.status(403).json({ 
                message: "Access denied",
                success: false 
            });
        }

        const students = await Student.find({ isActive: true })
            .select('-password')
            .populate('joinedTeams')
            .populate('joinedServers')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            students,
            count: students.length
        });

    } catch (err) {
        console.error("Error fetching all students:", err);
        res.status(500).json({ 
            message: "Failed to fetch students", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

// Delete Account (soft delete)
router.delete("/account", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({ 
                message: "Access denied",
                success: false 
            });
        }

        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ 
                message: "Password is required to delete account",
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

        // Verify password
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(400).json({ 
                message: "Incorrect password",
                success: false 
            });
        }

        // Soft delete - just mark as inactive
        student.isActive = false;
        await student.save();

        // Clear cookie
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax'
        });

        console.log("✅ Student account deleted:", student.username);

        res.status(200).json({
            message: "Account deleted successfully",
            success: true
        });

    } catch (err) {
        console.error("Error deleting account:", err);
        res.status(500).json({ 
            message: "Failed to delete account", 
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
            success: false 
        });
    }
});

console.log("🔧 All student routes defined");

module.exports = router;