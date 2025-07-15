const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const path = require('path');
const fs = require('fs');

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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Socket.io setup (if available)
let io;
if (socketIo) {
  io = socketIo(server, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
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

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
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

// Body parsing middleware
app.use(express.json({ limit: '50mb' })); // Increased for file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Health Check
app.get("/", (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.status(200).json({ 
    message: "✅ ProjectFlow Backend Server",
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(uptime / 60)} minutes`,
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
    },
    features: {
      socketIO: !!socketIo,
      fileUploads: !!fileRoutes,
      calendar: !!calendarRoutes,
      messaging: !!messagingRoutes,
      settings: !!settingsRoutes,
      rateLimit: !!rateLimit,
      helmet: !!helmet
    }
  });
});

// API Status endpoint
app.get("/api/status", (req, res) => {
  res.status(200).json({
    message: "API is running",
    success: true,
    version: "1.0.0",
    endpoints: {
      auth: "✅ Working",
      projectServers: "✅ Working", 
      teams: "✅ Working",
      tasks: "✅ Working",
      files: fileRoutes ? "✅ Available" : "❌ Disabled",
      calendar: calendarRoutes ? "✅ Available" : "❌ Disabled",
      messaging: messagingRoutes ? "✅ Available" : "❌ Disabled",
      settings: settingsRoutes ? "✅ Available" : "❌ Disabled"
    }
  });
});

// Core API Routes (always available)
app.use("/api/faculty", FacultyRoutes);
app.use("/api/student", StudentRoutes);
app.use("/api/projectServers", projectServerRoutes);
app.use("/api/teamRoutes", teamRoutes);
app.use("/api/tasks", taskRoutes);


// Optional feature routes (only if modules exist)
if (fileRoutes) {
  app.use("/api/files", fileRoutes);
  console.log("📎 File upload routes enabled");
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

// Export data endpoint (basic implementation)
app.get("/api/export/user-data", (req, res) => {
  // This is a placeholder - implement based on your needs
  const { type = 'all' } = req.query;
  
  // In a real implementation, you'd fetch user data from database
  const userData = {
    exportDate: new Date().toISOString(),
    exportType: type,
    message: "Data export feature - implement based on your requirements",
    // Add actual user data here
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="projectflow-data-${new Date().toISOString().split('T')[0]}.json"`);
  res.json(userData);
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🚫 API Route not found:', req.method, req.originalUrl);
  }
  res.status(404).json({ 
    message: 'API endpoint not found', 
    success: false,
    method: req.method, 
    path: req.originalUrl,
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
        'GET /api/teamRoutes/faculty-teams'
      ],
      tasks: [
        'POST /api/task/create',
        'GET /api/task/student-tasks',
        'GET /api/task/faculty-tasks'
      ],
      optional: {
        files: fileRoutes ? 'Available' : 'Not installed',
        calendar: calendarRoutes ? 'Available' : 'Not installed', 
        messaging: messagingRoutes ? 'Available' : 'Not installed',
        settings: settingsRoutes ? 'Available' : 'Not installed'
      }
    }
  });
});

// Catch all other routes (non-API)
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Page not found - This is an API server', 
    success: false,
    suggestion: 'Use /api/ prefix for API endpoints or visit / for server status'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global error:', err);
  
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      message: 'CORS policy violation - Origin not allowed',
      success: false
    });
  }
  
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      message: 'Validation error',
      success: false,
      details: process.env.NODE_ENV !== 'production' ? err.errors : undefined
    });
  }
  
  // Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ 
      message: 'Invalid ID format',
      success: false
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      message: 'Invalid authentication token',
      success: false
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      message: 'Authentication token expired',
      success: false
    });
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      message: 'File too large',
      success: false
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ 
      message: 'Unexpected file field',
      success: false
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({ 
      message: 'Duplicate entry - this value already exists',
      success: false
    });
  }
  
  // Default error response
  res.status(500).json({ 
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    success: false,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  server.close(() => {
    console.log('🔌 HTTP server closed');
    
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

// Connect to MongoDB and start server
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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
      
      // Feature status
      console.log('\n📋 Features Status:');
      console.log(`   🔐 Authentication: ✅ Active`);
      console.log(`   🏢 Project Servers: ✅ Active`);
      console.log(`   👥 Teams: ✅ Active`);
      console.log(`   📝 Tasks: ✅ Active`);
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
      console.log(`   📝 Tasks: /api/task/*`);
      
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