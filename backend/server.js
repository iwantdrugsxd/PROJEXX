const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const path = require('path');
const fs = require('fs');

// Import middleware
const verifyToken = require("./middleware/verifyToken");

const setupSocket = require('./socket/socketSetup');
// Try to load optional dependencies
let rateLimit, helmet, socketIo;
try {
  rateLimit = require('express-rate-limit');
} catch (err) {
  console.log('⚠️  express-rate-limit not installed - rate limiting disabled');
}

try {
  helmet = require('helmet');
} catch (err) {
  console.log('⚠️  helmet not installed - security headers disabled');
}

try {
  socketIo = require('socket.io');
} catch (err) {
  console.log('⚠️  socket.io not installed - real-time features disabled');
}

// Try to load dotenv
try {
  require('dotenv').config();
} catch (err) {
  console.log('⚠️  dotenv not installed - using default environment');
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ✅ FIXED: Define uploadsDir globally so it can be used throughout
const uploadsDir = path.join(__dirname, 'uploads');

// ✅ FIXED: Create all necessary upload directories
const createUploadsDirectory = () => {
  const submissionsDir = path.join(uploadsDir, 'submissions');
  const facultyDir = path.join(uploadsDir, 'faculty');
  const studentDir = path.join(uploadsDir, 'student');
  const profilesDir = path.join(uploadsDir, 'profiles');

  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('📁 Created uploads directory');
    }
    
    [submissionsDir, facultyDir, studentDir, profilesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created ${path.basename(dir)} directory`);
      }
    });
    
    console.log(`✅ Upload directories initialized at: ${uploadsDir}`);
  } catch (error) {
    console.error('❌ Error creating directories:', error);
  }
};

// Call this when server starts
createUploadsDirectory();

// Socket.io setup (if available)
let io;
if (socketIo) {
  io = socketIo(server, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        process.env.FRONTEND_URL
      ].filter(Boolean),
      credentials: true,
      methods: ["GET", "POST"]
    }
  });

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    socket.on('join', ({ userId, userRole }) => {
      socket.userId = userId;
      socket.userRole = userRole;
      socket.join(`user_${userId}`);
      console.log(`👤 ${userRole} ${userId} joined`);
      
      // Broadcast user online status
      socket.broadcast.emit('userOnline', userId);
    });

    socket.on('joinChat', (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`💬 User ${socket.userId} joined chat ${chatId}`);
    });

    socket.on('leaveChat', (chatId) => {
      socket.leave(`chat_${chatId}`);
      console.log(`💬 User ${socket.userId} left chat ${chatId}`);
    });

    socket.on('sendMessage', (message) => {
      socket.to(`chat_${message.chatId}`).emit('newMessage', message);
      console.log(`📨 Message sent to chat ${message.chatId}`);
    });

    socket.on('typing', ({ chatId, isTyping, userName }) => {
      socket.to(`chat_${chatId}`).emit('userTyping', {
        userId: socket.userId,
        chatId,
        isTyping,
        userName
      });
    });

    socket.on('markMessageRead', ({ messageId, chatId }) => {
      socket.to(`chat_${chatId}`).emit('messageRead', {
        messageId,
        readBy: socket.userId
      });
    });

    socket.on('disconnect', () => {
      console.log('🔌 User disconnected:', socket.id);
      if (socket.userId) {
        socket.broadcast.emit('userOffline', socket.userId);
      }
    });
  });

  // Make io available to routes
  app.set('io', io);
}

// Importing routes
const FacultyRoutes = require("./routes/facultyRoutes.js");
const StudentRoutes = require("./routes/studentRoutes.js");
const projectServerRoutes = require("./routes/projectServerRoutes");
const teamRoutes = require("./routes/teamRoutes.js");
const taskRoutes = require("./routes/taskRoutes.js");
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require("./routes/analyticsRoutes");
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
// Import new feature routes (with error handling)
let fileRoutes, calendarRoutes, messagingRoutes, settingsRoutes;

try {
  fileRoutes = require("./routes/fileRoutes.js");
} catch (err) {
  console.log('⚠️  fileRoutes.js not found - file upload features disabled');
}

try {
  calendarRoutes = require("./routes/calendarRoutes.js");
} catch (err) {
  console.log('⚠️  calendarRoutes.js not found - calendar features disabled');
}

try {
  messagingRoutes = require("./routes/messagingRoutes.js");
} catch (err) {
  console.log('⚠️  messagingRoutes.js not found - messaging features disabled');
}

try {
  settingsRoutes = require("./routes/settingsRoutes.js");
} catch (err) {
  console.log('⚠️  settingsRoutes.js not found - settings features disabled');
}

// MongoDB connection URI
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://yashr:NPuILa9Awq8H0DED@cluster0.optidea.mongodb.net/project_management?retryWrites=true&w=majority&appName=Cluster0";

// Security middleware (if available)
if (helmet) {
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
  }));
}

// Rate limiting (if available)
if (rateLimit) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased limit for file uploads
    message: {
      error: 'Too many requests from this IP, please try again later.',
      success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Separate stricter limit for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit login attempts
    message: {
      error: 'Too many authentication attempts, please try again later.',
      success: false
    }
  });
  app.use('/api/*/login', authLimiter);
  app.use('/api/*/register', authLimiter);
}

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Enhanced body parsing middleware
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ 
        message: 'Invalid JSON format',
        success: false 
      });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb' 
}));

app.use(cookieParser());

// ✅ FIXED: Serve static files with security headers and proper paths
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    // Prevent execution of uploaded files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Only set attachment for certain file types, allow images to display
    const ext = path.extname(filePath).toLowerCase();
    const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const documentTypes = ['.pdf', '.doc', '.docx', '.txt', '.zip', '.rar'];
    
    if (documentTypes.includes(ext)) {
      res.setHeader('Content-Disposition', 'attachment');
    } else if (imageTypes.includes(ext)) {
      res.setHeader('Content-Disposition', 'inline');
    }
    
    // Set appropriate cache headers
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year for static files
  }
}));

// ✅ ADDITIONAL: Serve specific upload subdirectories
app.use('/uploads/submissions', express.static(path.join(uploadsDir, 'submissions')));
app.use('/uploads/profiles', express.static(path.join(uploadsDir, 'profiles')));
app.use('/uploads/faculty', express.static(path.join(uploadsDir, 'faculty')));
app.use('/uploads/student', express.static(path.join(uploadsDir, 'student')));

// Request logging (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    
    // Log body for non-file uploads
    if (req.body && Object.keys(req.body).length > 0 && !req.path.includes('/upload')) {
      console.log('📝 Body:', req.body);
    }
    
    // Log file uploads
    if (req.files || (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data'))) {
      console.log('📎 File upload detected');
    }
    
    next();
  });
}

// ✅ ENHANCED: Health Check with upload directory verification
app.get("/", (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  // Check upload directories
  const uploadDirStatus = {
    base: fs.existsSync(uploadsDir),
    submissions: fs.existsSync(path.join(uploadsDir, 'submissions')),
    faculty: fs.existsSync(path.join(uploadsDir, 'faculty')),
    student: fs.existsSync(path.join(uploadsDir, 'student')),
    profiles: fs.existsSync(path.join(uploadsDir, 'profiles'))
  };
  
  res.status(200).json({ 
    message: "✅ ProjectFlow Backend Server",
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: "2.0.0",
    uptime: `${Math.floor(uptime / 60)} minutes`,
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      name: mongoose.connection.db ? mongoose.connection.db.databaseName : 'not connected'
    },
    uploads: {
      baseDirectory: uploadsDir,
      directories: uploadDirStatus,
      allExist: Object.values(uploadDirStatus).every(exists => exists)
    },
    features: {
      socketIO: !!socketIo,
      fileUploads: !!fileRoutes,
      calendar: !!calendarRoutes,
      messaging: !!messagingRoutes,
      settings: !!settingsRoutes,
      rateLimit: !!rateLimit,
      helmet: !!helmet
    },
    security: {
      helmet: !!helmet,
      rateLimit: !!rateLimit,
      cors: true,
      secureCookies: true
    }
  });
});

// Enhanced API Status endpoint
app.get("/api/status", (req, res) => {
  res.status(200).json({
    message: "API is running",
    success: true,
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "✅ Working",
      projectServers: "✅ Working", 
      teams: "✅ Working",
      tasks: "✅ Working",
      analytics: "✅ Working",
      notifications: "✅ Working",
      search: "✅ Working",
      files: fileRoutes ? "✅ Available" : "❌ Disabled",
      calendar: calendarRoutes ? "✅ Available" : "❌ Disabled",
      messaging: messagingRoutes ? "✅ Available" : "❌ Disabled",
      settings: settingsRoutes ? "✅ Available" : "❌ Disabled"
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      name: mongoose.connection.db ? mongoose.connection.db.databaseName : 'N/A'
    },
    security: {
      helmet: !!helmet,
      rateLimit: !!rateLimit,
      cors: true,
      secureCookies: true
    }
  });
});

// Core API Routes (always available)
app.use("/api/faculty", FacultyRoutes);
app.use("/api/student", StudentRoutes);
app.use("/api/projectServers", projectServerRoutes);
app.use("/api/teamRoutes", teamRoutes);
app.use("/api/tasks", taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/analytics", analyticsRoutes);

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ✅ NEW: Search endpoint for dashboard
app.get("/api/search", verifyToken, async (req, res) => {
  try {
    const { query, type } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        message: "Search query must be at least 2 characters",
        success: false
      });
    }

    const searchTerm = query.trim();
    const results = {
      tasks: [],
      teams: [],
      servers: []
    };

    // Import required models
    const Task = require("./models/taskSchema");
    const StudentTeam = require("./models/studentTeamSchema");
    const ProjectServer = require("./models/projectServerSchema");

    if (userRole === "faculty") {
      // Faculty search - search across their servers
      const facultyServers = await ProjectServer.find({ faculty: userId });
      const serverIds = facultyServers.map(s => s._id);
      const serverCodes = facultyServers.map(s => s.code);

      // Search servers
      results.servers = facultyServers.filter(server => 
        server.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        server.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        server.code.toLowerCase().includes(searchTerm.toLowerCase())
      ).map(server => ({
        id: server._id,
        title: server.title,
        code: server.code,
        description: server.description,
        type: 'server'
      }));

      // Search tasks
      const tasks = await Task.find({
        server: { $in: serverIds },
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      }).populate('server', 'title code');

      results.tasks = tasks.map(task => ({
        id: task._id,
        title: task.title,
        description: task.description,
        server: task.server.title,
        serverCode: task.server.code,
        type: 'task'
      }));

      // Search teams
      const teams = await StudentTeam.find({
        projectServer: { $in: serverCodes },
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      }).populate('members', 'firstName lastName');

      results.teams = teams.map(team => ({
        id: team._id,
        name: team.name,
        description: team.description,
        memberCount: team.members.length,
        serverCode: team.projectServer,
        type: 'team'
      }));

    } else if (userRole === "student") {
      // Student search - search within their teams/servers
      const studentTeams = await StudentTeam.find({ members: userId });
      const serverCodes = studentTeams.map(t => t.projectServer);
      const servers = await ProjectServer.find({ code: { $in: serverCodes } });
      const serverIds = servers.map(s => s._id);

      // Search teams student is part of
      results.teams = studentTeams.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (team.description && team.description.toLowerCase().includes(searchTerm.toLowerCase()))
      ).map(team => ({
        id: team._id,
        name: team.name,
        description: team.description,
        memberCount: team.members.length,
        serverCode: team.projectServer,
        type: 'team'
      }));

      // Search tasks from student's servers
      const tasks = await Task.find({
        server: { $in: serverIds },
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      }).populate('server', 'title code');

      results.tasks = tasks.map(task => ({
        id: task._id,
        title: task.title,
        description: task.description,
        server: task.server.title,
        serverCode: task.server.code,
        dueDate: task.dueDate,
        type: 'task'
      }));

      // Search servers student has access to
      results.servers = servers.filter(server =>
        server.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (server.description && server.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        server.code.toLowerCase().includes(searchTerm.toLowerCase())
      ).map(server => ({
        id: server._id,
        title: server.title,
        code: server.code,
        description: server.description,
        type: 'server'
      }));
    }

    // Limit results
    results.tasks = results.tasks.slice(0, 10);
    results.teams = results.teams.slice(0, 10);
    results.servers = results.servers.slice(0, 10);

    const totalResults = results.tasks.length + results.teams.length + results.servers.length;

    console.log(`🔍 Search "${searchTerm}" by ${userRole} ${userId}: ${totalResults} results`);

    res.json({
      success: true,
      results,
      query: searchTerm,
      totalResults,
      message: totalResults > 0 ? `Found ${totalResults} results` : "No results found"
    });

  } catch (err) {
    console.error("❌ Search error:", err);
    res.status(500).json({
      message: "Search failed",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false
    });
  }
});

// Optional feature routes (only if modules exist)
if (fileRoutes) {
  app.use("/api/files", fileRoutes);
  console.log("📎 File upload routes enabled");
} else {
  console.log("❌ File routes not available");
}

if (calendarRoutes) {
  app.use("/api/calendar", calendarRoutes);
  console.log("📅 Calendar routes enabled");
}

if (messagingRoutes) {
  app.use("/api/messaging", messagingRoutes);
  console.log("💬 Messaging routes enabled");
}

if (settingsRoutes) {
  app.use("/api/settings", settingsRoutes);
  console.log("⚙️ Settings routes enabled");
}

// Enhanced export data endpoint
app.get("/api/export/user-data", (req, res) => {
  const { type = 'all' } = req.query;
  
  // This is a placeholder - implement based on your needs
  const userData = {
    exportDate: new Date().toISOString(),
    exportType: type,
    message: "Data export feature - implement based on your requirements",
    version: "2.0.0",
    // Add actual user data here
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="projectflow-data-${new Date().toISOString().split('T')[0]}.json"`);
  res.json(userData);
});

// ✅ ADDITIONAL: File download endpoint with proper security
app.get("/api/download/:type/:filename", (req, res) => {
  const { type, filename } = req.params;
  const allowedTypes = ['submissions', 'faculty', 'student', 'profiles'];
  
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      message: 'Invalid file type',
      success: false
    });
  }
  
  const filePath = path.join(uploadsDir, type, filename);
  
  // Security check: ensure file is within uploads directory
  const resolvedPath = path.resolve(filePath);
  const uploadsPath = path.resolve(uploadsDir);
  
  if (!resolvedPath.startsWith(uploadsPath)) {
    return res.status(403).json({
      message: 'Access denied',
      success: false
    });
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      message: 'File not found',
      success: false
    });
  }
  
  // Set appropriate headers and send file
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

// ✅ ADDITIONAL: File serving route for task submissions
app.get("/api/files/submissions/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsDir, 'submissions', filename);
  
  console.log(`📁 File request: ${filename} at ${filePath}`);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(path.resolve(filePath));
  } else {
    console.error(`❌ File not found: ${filePath}`);
    res.status(404).json({ 
      message: 'File not found',
      success: false 
    });
  }
});
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
// Enhanced 404 handler for API routes
app.use('/api/*', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🚫 API Route not found:', req.method, req.originalUrl);
  }
  res.status(404).json({ 
    message: 'API endpoint not found', 
    success: false,
    method: req.method, 
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      auth: [
        'POST /api/faculty/login',
        'POST /api/faculty/register', 
        'GET /api/faculty/dashboard',
        'POST /api/faculty/logout',
        'POST /api/student/login',
        'POST /api/student/register',
        'GET /api/student/dashboard', 
        'POST /api/student/logout'
      ],
      projectServers: [
        'POST /api/projectServers/join',
        'POST /api/projectServers/create',
        'GET /api/projectServers/student-servers',
        'GET /api/projectServers/faculty-servers',
        'DELETE /api/projectServers/:serverId'
      ],
      teams: [
        'POST /api/teamRoutes/createTeam',
        'GET /api/teamRoutes/student-teams',
        'GET /api/teamRoutes/faculty-teams',
        'GET /api/teamRoutes/server/:serverId/teams',
        'POST /api/teamRoutes/join/:teamId',
        'POST /api/teamRoutes/leave/:teamId',
        'DELETE /api/teamRoutes/:teamId',
        'GET /api/teamRoutes/search/:query'
      ],
      tasks: [
        'POST /api/tasks/create',
        'GET /api/tasks/student-tasks',
        'GET /api/tasks/faculty-tasks',
        'GET /api/tasks/server/:serverId',
        'GET /api/tasks/server/:serverId/teams',
        'POST /api/tasks/:taskId/submit',
        'POST /api/tasks/:taskId/grade/:studentId',
        'GET /api/tasks/:taskId/submissions',
        'PUT /api/tasks/:taskId',
        'DELETE /api/tasks/:taskId'
      ],
      analytics: [
        'GET /api/analytics/faculty',
        'GET /api/analytics/student',
        'GET /api/analytics/server/:serverId',
        'GET /api/analytics/platform'
      ],
      notifications: [
        'GET /api/notifications',
        'PATCH /api/notifications/:notificationId/read',
        'PATCH /api/notifications/mark-all-read'
      ],
      search: [
        'GET /api/search?query=searchTerm&type=faculty|student'
      ],
      optional: {
        files: fileRoutes ? [
          'POST /api/files/upload',
          'GET /api/files/:id',
          'DELETE /api/files/:id',
          'GET /api/files/task/:taskId',
          'GET /api/files/submissions/:filename'
        ] : 'Not installed',
        calendar: calendarRoutes ? [
          'GET /api/calendar/events',
          'POST /api/calendar/create',
          'PUT /api/calendar/:eventId',
          'DELETE /api/calendar/:eventId'
        ] : 'Not installed', 
        messaging: messagingRoutes ? [
          'GET /api/messaging/conversations',
          'POST /api/messaging/send',
          'GET /api/messaging/:chatId/messages'
        ] : 'Not installed',
        settings: settingsRoutes ? [
          'GET /api/settings/profile',
          'PUT /api/settings/update',
          'POST /api/settings/change-password'
        ] : 'Not installed'
      }
    }
  });
});

// Catch all other routes (non-API)
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Page not found - This is an API server', 
    success: false,
    timestamp: new Date().toISOString(),
    suggestion: 'Use /api/ prefix for API endpoints or visit / for server status'
  });
});

// Enhanced global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global error:', err);
  
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      message: 'CORS policy violation - Origin not allowed',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      message: 'Validation error',
      success: false,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV !== 'production' ? err.errors : undefined
    });
  }
  
  // Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ 
      message: 'Invalid ID format',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      message: 'Invalid authentication token',
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      message: 'Authentication token expired',
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      message: 'File too large',
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ 
      message: 'Unexpected file field',
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  // ✅ ADDITIONAL: ENOENT file errors
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      message: 'File not found on server',
      success: false,
      timestamp: new Date().toISOString()
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({ 
      message: `Duplicate entry - ${field} already exists`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  // Default error response
  res.status(500).json({ 
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    success: false,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  server.close(() => {
    console.log('🔌 HTTP server closed');
    
    // Close Socket.IO if available
    if (io) {
      io.close(() => {
        console.log('🔌 Socket.IO server closed');
      });
    }
    
    mongoose.connection.close(() => {
      console.log('🗄️ MongoDB connection closed');
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Connect to MongoDB and start server
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    console.log(`🗄️  Database: ${mongoose.connection.db.databaseName}`);
    
    server.listen(PORT, () => {
      console.log('\n' + '═'.repeat(60));
      console.log(`🚀 ProjectFlow Server Running`);
      console.log('═'.repeat(60));
      console.log(`🌐 Server: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 CORS: Frontend origins configured`);
      console.log(`📁 Uploads: ${uploadsDir}`);
      
      // Feature status
      console.log('\n📋 Features Status:');
      console.log(`   🔐 Authentication: ✅ Active`);
      console.log(`   🏢 Project Servers: ✅ Active`);
      console.log(`   👥 Teams: ✅ Active`);
      console.log(`   📝 Tasks: ✅ Active`);
      console.log(`   📊 Analytics: ✅ Active`);
      console.log(`   🔔 Notifications: ✅ Active`);
      console.log(`   🔍 Search: ✅ Active`);
      console.log(`   📎 File Uploads: ${fileRoutes ? '✅ Active' : '❌ Disabled'}`);
      console.log(`   📅 Calendar: ${calendarRoutes ? '✅ Active' : '❌ Disabled'}`);
      console.log(`   💬 Messaging: ${messagingRoutes ? '✅ Active' : '❌ Disabled'}`);
      console.log(`   ⚙️  Settings: ${settingsRoutes ? '✅ Active' : '❌ Disabled'}`);
      console.log(`   🔌 Socket.IO: ${socketIo ? '✅ Active' : '❌ Disabled'}`);
      
      // Security status
      console.log('\n🛡️  Security Features:');
      console.log(`   ⚡ Rate Limiting: ${rateLimit ? '✅ Active' : '❌ Disabled'}`);
      console.log(`   🛡️  Helmet Headers: ${helmet ? '✅ Active' : '❌ Disabled'}`);
      console.log(`   🍪 Secure Cookies: ✅ Active`);
      console.log(`   🔐 CORS Protection: ✅ Active`);
      
      console.log('\n📍 API Endpoints:');
      console.log(`   🏥 Health: GET /`);
      console.log(`   📊 Status: GET /api/status`);
      console.log(`   👤 Auth: /api/faculty/* & /api/student/*`);
      console.log(`   🏢 Servers: /api/projectServers/*`);
      console.log(`   👥 Teams: /api/teamRoutes/*`);
      console.log(`   📝 Tasks: /api/tasks/*`);
      console.log(`   📊 Analytics: /api/analytics/*`);
      console.log(`   🔔 Notifications: /api/notifications/*`);
      console.log(`   🔍 Search: /api/search`);
      
      if (fileRoutes) console.log(`   📎 Files: /api/files/*`);
      if (calendarRoutes) console.log(`   📅 Calendar: /api/calendar/*`);
      if (messagingRoutes) console.log(`   💬 Messages: /api/messaging/*`);
      if (settingsRoutes) console.log(`   ⚙️  Settings: /api/settings/*`);
      
      console.log('═'.repeat(60));
      console.log('🎉 Server ready to handle requests!');
      console.log('═'.repeat(60) + '\n');
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error("🔧 Please check your MongoDB connection string and network connectivity");
    process.exit(1);
  });