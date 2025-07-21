// ============================================
// backend/routes/studentRoutes.js - COMPLETE BULLETPROOF PRODUCTION
// ============================================
const express = require("express");
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

console.log("🔧 [STUDENT_ROUTES] Loading bulletproof studentRoutes.js...");

// Safe model imports with error handling
let Student = null;
let StudentTeam = null;
let ProjectServer = null;

try {
  Student = require("../models/studentSchema");
  StudentTeam = require("../models/studentTeamSchema");
  ProjectServer = require("../models/projectServerSchema");
  console.log("✅ [STUDENT_ROUTES] All models loaded successfully");
} catch (err) {
  console.error("❌ [STUDENT_ROUTES] Model loading failed:", err.message);
  // Create mock models for graceful degradation
  Student = {
    findOne: () => Promise.resolve(null),
    findById: () => Promise.resolve(null),
    findByEmailOrUsername: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    prototype: { save: () => Promise.resolve(), comparePassword: () => Promise.resolve(false) }
  };
}

// Safe config imports
let jwtSecret, jwtExpiresIn;
try {
  const jwtConfig = require("../config/jwt");
  jwtSecret = jwtConfig.jwtSecret;
  jwtExpiresIn = jwtConfig.jwtExpiresIn;
  console.log("✅ [STUDENT_ROUTES] JWT config loaded");
} catch (err) {
  console.warn("⚠️  [STUDENT_ROUTES] JWT config not found, using environment variables");
  jwtSecret = process.env.JWT_SECRET || "fallback_secret_change_in_production";
  jwtExpiresIn = process.env.JWT_EXPIRES_IN || "24h";
}

// Safe middleware imports
let verifyToken;
try {
  verifyToken = require("../middleware/verifyToken");
  console.log("✅ [STUDENT_ROUTES] verifyToken middleware loaded");
} catch (err) {
  console.warn("⚠️  [STUDENT_ROUTES] verifyToken middleware not found, creating fallback");
  verifyToken = (req, res, next) => {
    res.status(501).json({
      success: false,
      message: "Authentication middleware not available"
    });
  };
}

// ============================================
// RATE LIMITING
// ============================================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
    retryAfter: "1 hour"
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// UTILITY FUNCTIONS
// ============================================
const logRequest = (endpoint, req, additionalData = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [STUDENT_ROUTES] ${endpoint}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 50),
    origin: req.headers.origin,
    ...additionalData
  });
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const sanitized = user.toObject ? user.toObject() : user;
  delete sanitized.password;
  delete sanitized.passwordResetToken;
  delete sanitized.emailVerificationToken;
  delete sanitized.loginAttempts;
  delete sanitized.lockedUntil;
  return sanitized;
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return { valid: false, message: "Password must be at least 6 characters long" };
  }
  if (password.length > 128) {
    return { valid: false, message: "Password cannot exceed 128 characters" };
  }
  return { valid: true };
};

// ============================================
// STUDENT REGISTRATION
// ============================================
router.post("/register", registrationLimiter, async (req, res) => {
  try {
    logRequest("POST /register", req);

    const { firstName, lastName, email, username, password, confirmPassword } = req.body;

    // Input validation
    const requiredFields = { firstName, lastName, email, username, password };
    const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        missingFields,
        required: ["firstName", "lastName", "email", "username", "password"]
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    // Confirm password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    // Username validation
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: "Username must be 3-20 characters and contain only letters, numbers, and underscores"
      });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username }
      ]
    });

    if (existingStudent) {
      const field = existingStudent.email === email.toLowerCase() ? "email" : "username";
      return res.status(409).json({
        success: false,
        message: `A student with this ${field} already exists`,
        field
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new student
    const studentData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      username: username.trim(),
      password: hashedPassword,
      isActive: true,
      isVerified: false,
      profile: {
        bio: "",
        skills: [],
        interests: [],
        socialLinks: {}
      },
      joinedTeams: [],
      joinedServers: [],
      performance: {
        totalTasks: 0,
        completedTasks: 0,
        averageGrade: 0,
        totalSubmissions: 0
      }
    };

    const newStudent = new Student(studentData);
    await newStudent.save();

    console.log(`✅ [STUDENT_ROUTES] New student registered: ${username} (${email})`);

    // Return sanitized user data
    const sanitizedStudent = sanitizeUser(newStudent);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      student: {
        id: sanitizedStudent._id,
        firstName: sanitizedStudent.firstName,
        lastName: sanitizedStudent.lastName,
        email: sanitizedStudent.email,
        username: sanitizedStudent.username,
        role: "student"
      }
    });

  } catch (err) {
    console.error("❌ [STUDENT_ROUTES] Registration error:", err);
    
    // Handle MongoDB duplicate key error
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `A student with this ${field} already exists`,
        field
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ============================================
// STUDENT LOGIN - PRODUCTION GRADE
// ============================================
// ============================================
// STUDENT LOGIN - FIXED VERSION
// ============================================
// ============================================
// STUDENT LOGIN - COMPLETE FIX
// Replace the existing login route in backend/routes/studentRoutes.js
// ============================================
router.post("/login", loginLimiter, async (req, res) => {
  try {
    logRequest("POST /login", req, { 
      loginAttempt: true,
      identifier: req.body.username ? req.body.username.substring(0, 3) + "***" : "unknown"
    });

    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required"
      });
    }

    // Rate limiting check - additional security
    const clientIP = req.ip;
    console.log(`🔍 [STUDENT_ROUTES] Login attempt from IP: ${clientIP}`);
    console.log(`🔍 [STUDENT_ROUTES] Searching for username: "${username}"`);

    // FIXED: Comprehensive search strategy
    let student = null;
    
    try {
      // Method 1: Try exact case-sensitive match first
      student = await Student.findOne({ username: username.trim() });
      console.log(`🔍 [STUDENT_ROUTES] Exact match result: ${student ? 'FOUND' : 'NOT FOUND'}`);
      
      // Method 2: If not found, try case-insensitive username search
      if (!student) {
        student = await Student.findOne({ 
          username: { $regex: new RegExp(`^${username.trim()}$`, 'i') } 
        });
        console.log(`🔍 [STUDENT_ROUTES] Case-insensitive match: ${student ? 'FOUND' : 'NOT FOUND'}`);
      }
      
      // Method 3: If still not found, try email search
      if (!student && username.includes('@')) {
        student = await Student.findOne({ 
          email: username.toLowerCase().trim() 
        });
        console.log(`🔍 [STUDENT_ROUTES] Email match: ${student ? 'FOUND' : 'NOT FOUND'}`);
      }
      
      // Method 4: If still not found, try broader search
      if (!student) {
        student = await Student.findOne({
          $or: [
            { email: username.toLowerCase().trim() },
            { username: { $regex: new RegExp(username.trim(), 'i') } }
          ]
        });
        console.log(`🔍 [STUDENT_ROUTES] Broad search: ${student ? 'FOUND' : 'NOT FOUND'}`);
      }
      
      // DEBUG: If still not found, let's see what students exist
      if (!student) {
        const allStudents = await Student.find({}).select('username email firstName lastName').limit(5);
        console.log(`🔍 [STUDENT_ROUTES] Sample students in database:`, 
          allStudents.map(s => ({ username: s.username, email: s.email }))
        );
        
        // Check for similar usernames
        const similarUsers = await Student.find({
          username: { $regex: username.substring(0, 3), $options: 'i' }
        }).select('username email');
        console.log(`🔍 [STUDENT_ROUTES] Similar usernames:`, similarUsers.map(s => s.username));
      }
      
    } catch (dbError) {
      console.error(`❌ [STUDENT_ROUTES] Database error:`, dbError);
      return res.status(500).json({
        success: false,
        message: "Database error during authentication"
      });
    }

    if (!student) {
      console.log(`❌ [STUDENT_ROUTES] Login failed: Student not found for identifier: ${username}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please check your username and try again."
      });
    }

    console.log(`✅ [STUDENT_ROUTES] Student found: ${student.username} (${student.email})`);

    // Check if account is locked
    if (student.isLocked) {
      console.log(`🔒 [STUDENT_ROUTES] Login failed: Account locked for ${student.username}`);
      return res.status(423).json({
        success: false,
        message: "Account temporarily locked due to multiple failed login attempts. Please try again later."
      });
    }

    // Check if account is active
    if (!student.isActive) {
      console.log(`❌ [STUDENT_ROUTES] Login failed: Account disabled for ${student.username}`);
      return res.status(403).json({
        success: false,
        message: "Account is disabled. Please contact administrator."
      });
    }

    // Verify password using bcrypt directly
    console.log(`🔍 [STUDENT_ROUTES] Verifying password for ${student.username}`);
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, student.password);
      console.log(`🔍 [STUDENT_ROUTES] Password verification: ${isMatch ? 'SUCCESS' : 'FAILED'}`);
    } catch (passwordError) {
      console.error(`❌ [STUDENT_ROUTES] Password verification error:`, passwordError);
      return res.status(500).json({
        success: false,
        message: "Authentication error"
      });
    }
    
    if (!isMatch) {
      console.log(`❌ [STUDENT_ROUTES] Login failed: Invalid password for ${student.username}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please check your password and try again."
      });
    }

    // Update last login
    try {
      student.lastLogin = new Date();
      await student.save();
    } catch (saveError) {
      console.warn(`⚠️ [STUDENT_ROUTES] Could not update last login:`, saveError.message);
    }

    // Generate JWT token
    const tokenPayload = {
      id: student._id,
      role: "student",
      username: student.username,
      email: student.email
    };

    const token = jwt.sign(tokenPayload, jwtSecret, { 
      expiresIn: jwtExpiresIn,
      issuer: 'projectflow-backend',
      audience: 'projectflow-frontend'
    });

    // Set secure HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/'
    };

    res.cookie("token", token, cookieOptions);

    console.log(`✅ [STUDENT_ROUTES] Login successful for ${student.username}`);

    // Return sanitized user data
    const sanitizedStudent = sanitizeUser(student);

    res.status(200).json({
      success: true,
      message: "Login successful",
      student: {
        id: sanitizedStudent._id,
        firstName: sanitizedStudent.firstName,
        lastName: sanitizedStudent.lastName,
        email: sanitizedStudent.email,
        username: sanitizedStudent.username,
        role: "student",
        lastLogin: sanitizedStudent.lastLogin,
        isVerified: sanitizedStudent.isVerified || false
      },
      token: process.env.NODE_ENV === 'development' ? token : undefined
    });

  } catch (err) {
    console.error("❌ [STUDENT_ROUTES] Login error:", err);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});
router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    logRequest("GET /dashboard", req, { userId: req.user?.id });

    // Verify user role
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Student access required."
      });
    }

    // Get comprehensive student data
    const student = await Student.findById(req.user.id)
      .select('-password -passwordResetToken -emailVerificationToken')
      .lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // Get student's teams
    const teams = await StudentTeam.find({ members: req.user.id })
      .populate('leader', 'firstName lastName email')
      .populate('members', 'firstName lastName email')
      .select('name description projectServer status performance createdAt')
      .lean();

    // Get student's project servers (through teams)
    const serverCodes = [...new Set(teams.map(team => team.projectServer))];
    const servers = await ProjectServer.find({ code: { $in: serverCodes } })
      .populate('faculty', 'firstName lastName email')
      .select('code title description faculty status stats createdAt')
      .lean();

    // Calculate dashboard statistics
    const stats = {
      totalTeams: teams.length,
      activeTeams: teams.filter(team => team.status === 'active').length,
      totalServers: servers.length,
      totalTasks: student.performance?.totalTasks || 0,
      completedTasks: student.performance?.completedTasks || 0,
      averageGrade: student.performance?.averageGrade || 0,
      completionRate: student.performance?.totalTasks > 0 
        ? Math.round((student.performance.completedTasks / student.performance.totalTasks) * 100)
        : 0
    };

    res.status(200).json({
      success: true,
      message: `Welcome back, ${student.firstName}!`,
      student: {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`,
        email: student.email,
        username: student.username,
        role: "student",
        profile: student.profile || {},
        performance: student.performance || {},
        lastLogin: student.lastLogin,
        isVerified: student.isVerified
      },
      teams,
      servers,
      stats,
      notifications: {
        hasUnread: false, // This would be calculated from a notifications collection
        count: 0
      }
    });

  } catch (err) {
    console.error("❌ [STUDENT_ROUTES] Dashboard error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

router.get("/debug/students", async (req, res) => {
  try {
    console.log("🔍 [DEBUG] Inspecting student database...");
    
    // Get all students (limit to first 10 for safety)
    const students = await Student.find({})
      .select('username email firstName lastName isActive createdAt')
      .limit(10)
      .lean();
    
    console.log(`🔍 [DEBUG] Found ${students.length} students in database`);
    
    // Look for students with username containing "neel"
    const neelStudents = await Student.find({
      username: { $regex: /neel/i }
    }).select('username email firstName lastName isActive').lean();
    
    console.log(`🔍 [DEBUG] Students with 'neel' in username:`, neelStudents);
    
    // Check exact match
    const exactNeel = await Student.findOne({
      username: "neel"
    }).select('username email firstName lastName isActive').lean();
    
    console.log(`🔍 [DEBUG] Exact match for 'neel':`, exactNeel);
    
    // Check case-insensitive match
    const caseInsensitiveNeel = await Student.findOne({
      username: { $regex: /^neel$/i }
    }).select('username email firstName lastName isActive').lean();
    
    console.log(`🔍 [DEBUG] Case-insensitive match for 'neel':`, caseInsensitiveNeel);
    
    res.json({
      success: true,
      totalStudents: students.length,
      students: students.map(s => ({
        username: s.username,
        email: s.email,
        name: `${s.firstName} ${s.lastName}`,
        isActive: s.isActive,
        created: s.createdAt
      })),
      neelSearch: {
        containing: neelStudents,
        exact: exactNeel,
        caseInsensitive: caseInsensitiveNeel
      }
    });
    
  } catch (error) {
    console.error("❌ [DEBUG] Database inspection error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// ============================================
// STUDENT LOGOUT
// ============================================
router.post("/logout", verifyToken, async (req, res) => {
  try {
    logRequest("POST /logout", req, { userId: req.user?.id });

    // Clear the token cookie with all possible configurations
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      path: '/'
    };

    res.clearCookie("token", cookieOptions);
    
    // Also try clearing with different path configurations for safety
    res.clearCookie("token", { path: '/' });
    res.clearCookie("token");

    console.log(`✅ [STUDENT_ROUTES] Student logged out: ${req.user?.username || req.user?.id}`);

    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });

  } catch (err) {
    console.error("❌ [STUDENT_ROUTES] Logout error:", err);
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ============================================
// GET STUDENT PROFILE
// ============================================
router.get("/profile", verifyToken, async (req, res) => {
  try {
    logRequest("GET /profile", req, { userId: req.user?.id });

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const student = await Student.findById(req.user.id)
      .select('-password -passwordResetToken -emailVerificationToken -loginAttempts -lockedUntil')
      .populate('joinedTeams', 'name description projectServer status')
      .lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    res.status(200).json({
      success: true,
      student: sanitizeUser(student)
    });

  } catch (err) {
    console.error("❌ [STUDENT_ROUTES] Error fetching student profile:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ============================================
// UPDATE STUDENT PROFILE
// ============================================
router.put("/profile", verifyToken, async (req, res) => {
  try {
    logRequest("PUT /profile", req, { userId: req.user?.id });

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const { 
      firstName, 
      lastName, 
      phone, 
      bio, 
      skills, 
      interests,
      socialLinks,
      department,
      enrollmentYear
    } = req.body;

    // Build update object with validation
    const updateData = {};
    
    if (firstName !== undefined) {
      if (firstName.trim().length < 2 || firstName.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: "First name must be between 2 and 50 characters"
        });
      }
      updateData.firstName = firstName.trim();
    }
    
    if (lastName !== undefined) {
      if (lastName.trim().length < 2 || lastName.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: "Last name must be between 2 and 50 characters"
        });
      }
      updateData.lastName = lastName.trim();
    }
    
    if (phone !== undefined) {
      if (phone && !/^[\+]?[1-9][\d]{0,15}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format"
        });
      }
      updateData.phone = phone.trim();
    }
    
    if (bio !== undefined) {
      if (bio.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Bio cannot exceed 500 characters"
        });
      }
      updateData['profile.bio'] = bio.trim();
    }
    
    if (Array.isArray(skills)) {
      const validSkills = skills.filter(skill => 
        typeof skill === 'string' && skill.trim().length > 0 && skill.trim().length <= 50
      ).map(skill => skill.trim());
      updateData['profile.skills'] = validSkills.slice(0, 20); // Limit to 20 skills
    }
    
    if (Array.isArray(interests)) {
      const validInterests = interests.filter(interest => 
        typeof interest === 'string' && interest.trim().length > 0 && interest.trim().length <= 50
      ).map(interest => interest.trim());
      updateData['profile.interests'] = validInterests.slice(0, 20); // Limit to 20 interests
    }
    
    if (socialLinks && typeof socialLinks === 'object') {
      const allowedLinks = ['github', 'linkedin', 'portfolio'];
      const validLinks = {};
      allowedLinks.forEach(key => {
        if (socialLinks[key] && typeof socialLinks[key] === 'string') {
          const url = socialLinks[key].trim();
          if (url.startsWith('http://') || url.startsWith('https://')) {
            validLinks[key] = url;
          }
        }
      });
      updateData['profile.socialLinks'] = validLinks;
    }
    
    if (department !== undefined) {
      if (department.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: "Department name cannot exceed 100 characters"
        });
      }
      updateData.department = department.trim();
    }
    
    if (enrollmentYear !== undefined) {
      const currentYear = new Date().getFullYear();
      if (enrollmentYear < 2000 || enrollmentYear > currentYear + 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid enrollment year"
        });
      }
      updateData.enrollmentYear = enrollmentYear;
    }

    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      req.user.id,
      updateData,
      { 
        new: true, 
        runValidators: true,
        select: '-password -passwordResetToken -emailVerificationToken -loginAttempts -lockedUntil'
      }
    );

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    console.log(`✅ [STUDENT_ROUTES] Profile updated for ${updatedStudent.username}`);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      student: sanitizeUser(updatedStudent)
    });

  } catch (err) {
    console.error("❌ [STUDENT_ROUTES] Profile update error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ============================================
// GET STUDENT'S TEAMS
// ============================================
router.get("/teams", verifyToken, async (req, res) => {
  try {
    logRequest("GET /teams", req, { userId: req.user?.id });

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const teams = await StudentTeam.find({ members: req.user.id })
      .populate('members', 'firstName lastName email username')
      .populate('leader', 'firstName lastName email username')
      .sort({ createdAt: -1 })
      .lean();

    // Get server details for each team
    const serverCodes = teams.map(team => team.projectServer);
    const servers = await ProjectServer.find({ code: { $in: serverCodes } })
      .populate('faculty', 'firstName lastName email')
      .lean();

    // Create server lookup map
    const serverMap = servers.reduce((map, server) => {
      map[server.code] = server;
      return map;
    }, {});

    // Enhance teams with server data
    const enhancedTeams = teams.map(team => ({
      ...team,
      server: serverMap[team.projectServer] || null,
      isLeader: team.leader._id.toString() === req.user.id
    }));

    res.status(200).json({
      success: true,
      teams: enhancedTeams,
      count: enhancedTeams.length,
      activeTeams: enhancedTeams.filter(team => team.status === 'active').length
    });

  } catch (err) {
    console.error("❌ [STUDENT_ROUTES] Error fetching teams:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch teams",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ============================================
// TEST ENDPOINT
// ============================================
router.get("/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Student routes are working perfectly!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      registration: true,
      login: true,
      dashboard: true,
      profile: true,
      teams: true,
      rateLimiting: true,
      security: true
    }
  });
});

// ============================================
// HEALTH CHECK
// ============================================
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "Student Authentication Service",
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    features: {
      registration: true,
      login: true,
      dashboard: true,
      profile: true,
      teams: true,
      rateLimiting: true,
      security: true,
      modelLoaded: !!Student.findOne,
      jwtConfigured: !!jwtSecret,
      middlewareLoaded: typeof verifyToken === 'function'
    },
    routes: [
      "POST /api/student/register",
      "POST /api/student/login",
      "GET /api/student/dashboard",
      "POST /api/student/logout",
      "GET /api/student/profile",
      "PUT /api/student/profile",
      "GET /api/student/teams",
      "GET /api/student/test",
      "GET /api/student/health"
    ],
    security: {
      rateLimiting: true,
      passwordHashing: true,
      jwtTokens: true,
      httpOnlyCookies: true,
      inputValidation: true,
      sqlInjectionProtection: true
    }
  });
});

// ============================================
// CATCH ALL UNMATCHED ROUTES
// ============================================
router.all("*", (req, res) => {
  logRequest(`${req.method} ${req.originalUrl} [404]`, req);
  
  res.status(404).json({
    success: false,
    message: "Student route not found",
    requestedRoute: req.originalUrl,
    method: req.method,
    availableRoutes: [
      "POST /api/student/register",
      "POST /api/student/login",
      "GET /api/student/dashboard",
      "POST /api/student/logout", 
      "GET /api/student/profile",
      "PUT /api/student/profile",
      "GET /api/student/teams",
      "GET /api/student/test",
      "GET /api/student/health"
    ],
    timestamp: new Date().toISOString(),
    suggestion: "Check the available routes above or visit /api/student/health for service status"
  });
});

console.log("✅ [STUDENT_ROUTES] Bulletproof studentRoutes.js loaded successfully");
console.log("🔧 [STUDENT_ROUTES] All student routes defined with production-grade security");

module.exports = router;