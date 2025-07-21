// backend/routes/facultyRoutes.js - NO JWT TOKEN VERSION
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// Import models
const Faculty = require('../models/facultySchema');

// Utility function for consistent logging
const logWithTimestamp = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FACULTY] [${level.toUpperCase()}] ${message}`, data);
};

// ✅ HEALTH CHECK ENDPOINT
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    route: 'faculty',
    authentication: 'disabled',
    availableEndpoints: [
      'POST /register - Register faculty',
      'POST /login - Login faculty', 
      'GET /profile/:facultyId - Get faculty profile',
      'PUT /profile/:facultyId - Update faculty profile'
    ]
  });
});

// ✅ REGISTER FACULTY - NO TOKEN
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, department, employeeId } = req.body;

    logWithTimestamp('info', 'Faculty registration attempt', {
      email: email,
      department: department
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

    // Check if faculty already exists
    const existingFaculty = await Faculty.findOne({ email: email.toLowerCase() });
    if (existingFaculty) {
      return res.status(400).json({
        success: false,
        message: 'Faculty with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create faculty
    const newFaculty = new Faculty({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      department: department?.trim(),
      employeeId: employeeId?.trim(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newFaculty.save();

    // Return faculty data without password
    const facultyData = {
      id: newFaculty._id,
      firstName: newFaculty.firstName,
      lastName: newFaculty.lastName,
      email: newFaculty.email,
      department: newFaculty.department,
      employeeId: newFaculty.employeeId,
      role: 'faculty',
      isActive: newFaculty.isActive,
      createdAt: newFaculty.createdAt
    };

    logWithTimestamp('info', 'Faculty registered successfully', {
      facultyId: newFaculty._id,
      email: email
    });

    res.status(201).json({
      success: true,
      message: 'Faculty registered successfully',
      faculty: facultyData
    });

  } catch (error) {
    logWithTimestamp('error', 'Faculty registration failed', {
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

// ✅ LOGIN FACULTY - NO TOKEN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    logWithTimestamp('info', 'Faculty login attempt', {
      email: email
    });

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find faculty
    const faculty = await Faculty.findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    });

    if (!faculty) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, faculty.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    faculty.lastLogin = new Date();
    await faculty.save();

    // Return faculty data without password
    const facultyData = {
      id: faculty._id,
      firstName: faculty.firstName,
      lastName: faculty.lastName,
      email: faculty.email,
      department: faculty.department,
      employeeId: faculty.employeeId,
      role: 'faculty',
      isActive: faculty.isActive,
      lastLogin: faculty.lastLogin
    };

    logWithTimestamp('info', 'Faculty login successful', {
      facultyId: faculty._id,
      email: email
    });

    res.json({
      success: true,
      message: 'Login successful',
      faculty: facultyData
    });

  } catch (error) {
    logWithTimestamp('error', 'Faculty login failed', {
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

// ✅ GET FACULTY PROFILE - NO TOKEN
router.get('/profile/:facultyId', async (req, res) => {
  try {
    const { facultyId } = req.params;

    const faculty = await Faculty.findById(facultyId).select('-password');

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    const facultyData = {
      id: faculty._id,
      firstName: faculty.firstName,
      lastName: faculty.lastName,
      email: faculty.email,
      department: faculty.department,
      employeeId: faculty.employeeId,
      role: 'faculty',
      isActive: faculty.isActive,
      createdAt: faculty.createdAt,
      lastLogin: faculty.lastLogin
    };

    res.json({
      success: true,
      faculty: facultyData
    });

  } catch (error) {
    logWithTimestamp('error', 'Get faculty profile failed', {
      error: error.message,
      facultyId: req.params.facultyId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get faculty profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ UPDATE FACULTY PROFILE - NO TOKEN
router.put('/profile/:facultyId', async (req, res) => {
  try {
    const { facultyId } = req.params;
    const { firstName, lastName, department, employeeId } = req.body;

    const faculty = await Faculty.findById(facultyId);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    // Update fields
    const updateData = { updatedAt: new Date() };
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (department) updateData.department = department.trim();
    if (employeeId) updateData.employeeId = employeeId.trim();

    const updatedFaculty = await Faculty.findByIdAndUpdate(
      facultyId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    const facultyData = {
      id: updatedFaculty._id,
      firstName: updatedFaculty.firstName,
      lastName: updatedFaculty.lastName,
      email: updatedFaculty.email,
      department: updatedFaculty.department,
      employeeId: updatedFaculty.employeeId,
      role: 'faculty',
      isActive: updatedFaculty.isActive,
      updatedAt: updatedFaculty.updatedAt
    };

    logWithTimestamp('info', 'Faculty profile updated', {
      facultyId: facultyId,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      faculty: facultyData
    });

  } catch (error) {
    logWithTimestamp('error', 'Update faculty profile failed', {
      error: error.message,
      facultyId: req.params.facultyId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET ALL FACULTY - NO TOKEN (for admin purposes)
router.get('/all', async (req, res) => {
  try {
    const { limit = 50, page = 1, search, department } = req.query;

    // Build query
    let query = { isActive: true };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (department) {
      query.department = { $regex: department, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [facultyList, total] = await Promise.all([
      Faculty.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Faculty.countDocuments(query)
    ]);

    const facultyData = facultyList.map(faculty => ({
      id: faculty._id,
      firstName: faculty.firstName,
      lastName: faculty.lastName,
      email: faculty.email,
      department: faculty.department,
      employeeId: faculty.employeeId,
      role: 'faculty',
      isActive: faculty.isActive,
      createdAt: faculty.createdAt,
      lastLogin: faculty.lastLogin
    }));

    res.json({
      success: true,
      faculty: facultyData,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + facultyList.length < total
      }
    });

  } catch (error) {
    logWithTimestamp('error', 'Get all faculty failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get faculty list',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;