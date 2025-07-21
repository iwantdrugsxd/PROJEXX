// backend/routes/studentRoutes.js - NO JWT TOKEN VERSION
const express = require('express');
const router = express.Router();
// const bcrypt = require('bcryptjs');

// Import models
const Student = require('../models/studentSchema');

// Utility function for consistent logging
const logWithTimestamp = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [STUDENT] [${level.toUpperCase()}] ${message}`, data);
};

// ✅ HEALTH CHECK ENDPOINT
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    route: 'student',
    authentication: 'disabled',
    availableEndpoints: [
      'POST /register - Register student',
      'POST /login - Login student',
      'GET /profile/:studentId - Get student profile',
      'PUT /profile/:studentId - Update student profile'
    ]
  });
});

// ✅ REGISTER STUDENT - NO TOKEN
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, studentId, year, major } = req.body;

    logWithTimestamp('info', 'Student registration attempt', {
      email: email,
      studentId: studentId
    });

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
        required: ['firstName', 'lastName', 'email', 'password']
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { studentId: studentId }
      ]
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student with this email or student ID already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create student
    const newStudent = new Student({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      studentId: studentId?.trim(),
      year: year,
      major: major?.trim(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newStudent.save();

    // Return student data without password
    const studentData = {
      id: newStudent._id,
      firstName: newStudent.firstName,
      lastName: newStudent.lastName,
      email: newStudent.email,
      studentId: newStudent.studentId,
      year: newStudent.year,
      major: newStudent.major,
      role: 'student',
      isActive: newStudent.isActive,
      createdAt: newStudent.createdAt
    };

    logWithTimestamp('info', 'Student registered successfully', {
      studentDbId: newStudent._id,
      studentId: studentId,
      email: email
    });

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      student: studentData
    });

  } catch (error) {
    logWithTimestamp('error', 'Student registration failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ LOGIN STUDENT - NO TOKEN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    logWithTimestamp('info', 'Student login attempt', {
      email: email
    });

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find student
    const student = await Student.findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    });

    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, student.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    student.lastLogin = new Date();
    await student.save();

    // Return student data without password
    const studentData = {
      id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      studentId: student.studentId,
      year: student.year,
      major: student.major,
      role: 'student',
      isActive: student.isActive,
      lastLogin: student.lastLogin
    };

    logWithTimestamp('info', 'Student login successful', {
      studentDbId: student._id,
      studentId: student.studentId,
      email: email
    });

    res.json({
      success: true,
      message: 'Login successful',
      student: studentData
    });

  } catch (error) {
    logWithTimestamp('error', 'Student login failed', {
      error: error.message,
      email: req.body.email
    });

    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET STUDENT PROFILE - NO TOKEN
router.get('/profile/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId).select('-password');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const studentData = {
      id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      studentId: student.studentId,
      year: student.year,
      major: student.major,
      role: 'student',
      isActive: student.isActive,
      createdAt: student.createdAt,
      lastLogin: student.lastLogin
    };

    res.json({
      success: true,
      student: studentData
    });

  } catch (error) {
    logWithTimestamp('error', 'Get student profile failed', {
      error: error.message,
      studentId: req.params.studentId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get student profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ UPDATE STUDENT PROFILE - NO TOKEN
router.put('/profile/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { firstName, lastName, year, major } = req.body;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Update fields
    const updateData = { updatedAt: new Date() };
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (year) updateData.year = year;
    if (major) updateData.major = major.trim();

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    const studentData = {
      id: updatedStudent._id,
      firstName: updatedStudent.firstName,
      lastName: updatedStudent.lastName,
      email: updatedStudent.email,
      studentId: updatedStudent.studentId,
      year: updatedStudent.year,
      major: updatedStudent.major,
      role: 'student',
      isActive: updatedStudent.isActive,
      updatedAt: updatedStudent.updatedAt
    };

    logWithTimestamp('info', 'Student profile updated', {
      studentDbId: studentId,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      student: studentData
    });

  } catch (error) {
    logWithTimestamp('error', 'Update student profile failed', {
      error: error.message,
      studentId: req.params.studentId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET ALL STUDENTS - NO TOKEN (for admin purposes)
router.get('/all', async (req, res) => {
  try {
    const { limit = 50, page = 1, search, year, major } = req.query;

    // Build query
    let query = { isActive: true };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (year) {
      query.year = parseInt(year);
    }
    
    if (major) {
      query.major = { $regex: major, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [studentList, total] = await Promise.all([
      Student.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Student.countDocuments(query)
    ]);

    const studentData = studentList.map(student => ({
      id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      studentId: student.studentId,
      year: student.year,
      major: student.major,
      role: 'student',
      isActive: student.isActive,
      createdAt: student.createdAt,
      lastLogin: student.lastLogin
    }));

    res.json({
      success: true,
      students: studentData,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + studentList.length < total
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Get all students failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get student list',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ SEARCH STUDENTS - NO TOKEN
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 20 } = req.query;

    const students = await Student.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
            { studentId: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .select('-password')
    .limit(parseInt(limit))
    .sort({ firstName: 1 });

    const studentData = students.map(student => ({
      id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      studentId: student.studentId,
      year: student.year,
      major: student.major,
      role: 'student'
    }));

    res.json({
      success: true,
      students: studentData,
      query: query,
      count: students.length
    });

  } catch (error) {
    logWithTimestamp('error', 'Search students failed', {
      error: error.message,
      query: req.params.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to search students',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;