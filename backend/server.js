// backend/server.js - PRODUCTION LEVEL COMPLETE SERVER
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

// Load environment variables FIRST
require('dotenv').config();

// Optional dependencies with graceful fallback
let helmet, rateLimit, compression, morgan;
try {
  helmet = require("helmet");
  console.log('✅ helmet loaded');
} catch (err) {
  console.log('⚠️  helmet not found - security headers disabled');
}

try {
  rateLimit = require("express-rate-limit");
  console.log('✅ express-rate-limit loaded');
} catch (err) {
  console.log('⚠️  express-rate-limit not found - rate limiting disabled');
}

try {
  compression = require("compression");
  console.log('✅ compression loaded');
} catch (err) {
  console.log('⚠️  compression not found - response compression disabled');
}

try {
  morgan = require("morgan");
  console.log('✅ morgan loaded');
} catch (err) {
  console.log('⚠️  morgan not found - HTTP request logging disabled');
}

const app = express();
const PORT = process.env.PORT || 5000;

// ==============================================
// SECURITY & TRUST CONFIGURATION
// ==============================================

// Enable trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security headers
if (helmet) {
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
}

// ==============================================
// CORS CONFIGURATION - FIXED FOR PRODUCTION
// ==============================================

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'https://yourdomain.com', // Add your production domain
      process.env.FRONTEND_URL,
      process.env.CLIENT_URL
    ].filter(Boolean);
    
    console.log('🔍 CORS Check - Origin:', origin);
    console.log('🔍 CORS Check - Allowed Origins:', allowedOrigins);
    
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) {
      console.log('✅ CORS - No origin, allowing request');
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS - Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS - Origin blocked:', origin);
      // In development, allow it anyway with warning
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️  CORS - Allowing in development mode');
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'Cache-Control', 
    'Pragma', 
    'Expires',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// ==============================================
// RATE LIMITING
// ==============================================

if (rateLimit) {
  // General API rate limiting
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.originalUrl === '/api/health' || req.originalUrl === '/';
    }
  });
  app.use('/api/', generalLimiter);

  // Stricter auth rate limiting
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // login attempts per windowMs
    message: {
      error: 'Too many authentication attempts, please try again later.',
      success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/faculty/login', authLimiter);
  app.use('/api/student/login', authLimiter);
  app.use('/api/faculty/register', authLimiter);
  app.use('/api/student/register', authLimiter);

  // File upload rate limiting
  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // uploads per windowMs
    message: {
      error: 'Too many upload requests, please try again later.',
      success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/files', uploadLimiter);
}

// ==============================================
// BODY PARSING MIDDLEWARE
// ==============================================

app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf, encoding) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb' 
}));

app.use(cookieParser());

// ==============================================
// COMPRESSION MIDDLEWARE
// ==============================================

if (compression) {
  app.use(compression());
}

// ==============================================
// LOGGING MIDDLEWARE
// ==============================================

if (morgan) {
  app.use(morgan('combined'));
}

// Enhanced request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  
  // Log all requests with detailed info
  console.log(`[${timestamp}] [SERVER] ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    referer: req.headers.referer,
    contentType: req.headers['content-type'],
    cookies: req.cookies ? Object.keys(req.cookies) : 'No cookies'
  });
  
  // Log request body for non-file uploads (debugging)
  if (req.body && Object.keys(req.body).length > 0 && 
      !req.originalUrl.includes('/upload') && 
      req.method === 'POST' && 
      process.env.NODE_ENV === 'development') {
    console.log(`[${timestamp}] [SERVER] Request body:`, JSON.stringify(req.body, null, 2));
  }
  
  // Log file uploads
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    console.log(`[${timestamp}] [SERVER] Multipart form data detected - file upload in progress`);
  }
  
  next();
});

// ==============================================
// STATIC FILE SERVING
// ==============================================

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==============================================
// SOCKET.IO SETUP
// ==============================================

let server, io;
try {
  server = require('http').createServer(app);
  io = require('socket.io')(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);
    
    socket.on('join', (userId) => {
      socket.userId = userId;
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined room`);
      socket.broadcast.emit('userOnline', userId);
    });

    socket.on('authenticate', ({ userId, userRole }) => {
      const room = `${userRole}_${userId}`;
      socket.join(room);
      console.log(`👤 User ${userId} authenticated and joined room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log('👤 User disconnected:', socket.id);
      if (socket.userId) {
        socket.broadcast.emit('userOffline', socket.userId);
      }
    });
  });

  // Make io available globally
  app.set('io', io);
  global.io = io;
  
  console.log('✅ Socket.io initialized');
} catch (err) {
  console.log('⚠️  Socket.io not available - real-time features disabled');
  server = require('http').createServer(app);
}

// ==============================================
// MONGODB CONNECTION
// ==============================================

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://yashr:NPuILa9Awq8H0DED@cluster0.optidea.mongodb.net/project_management?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ Connected to MongoDB successfully");
  console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
})
.catch((err) => {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1);
});

// MongoDB event listeners
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// ==============================================
// ROUTE IMPORTS WITH ERROR HANDLING
// ==============================================

// Core routes
let facultyRoutes, studentRoutes, projectServerRoutes, teamRoutes, taskRoutes, notificationRoutes, analyticsRoutes;

try {
  facultyRoutes = require("./routes/facultyRoutes");
  console.log('✅ Faculty routes loaded');
} catch (err) {
  console.log('❌ facultyRoutes.js not found:', err.message);
}

try {
  studentRoutes = require("./routes/studentRoutes");
  console.log('✅ Student routes loaded');
} catch (err) {
  console.log('❌ studentRoutes.js not found:', err.message);
}

try {
  projectServerRoutes = require("./routes/projectServerRoutes");
  console.log('✅ Project server routes loaded');
} catch (err) {
  console.log('❌ projectServerRoutes.js not found:', err.message);
}

try {
  teamRoutes = require("./routes/teamRoutes");
  console.log('✅ Team routes loaded');
} catch (err) {
  console.log('❌ teamRoutes.js not found:', err.message);
}

try {
  taskRoutes = require("./routes/taskRoutes");
  console.log('✅ Task routes loaded');
} catch (err) {
  console.log('❌ taskRoutes.js not found:', err.message);
}

try {
  notificationRoutes = require('./routes/notificationRoutes');
  console.log('✅ Notification routes loaded');
} catch (err) {
  console.log('❌ notificationRoutes.js not found:', err.message);
}

try {
  analyticsRoutes = require("./routes/analyticsRoutes");
  console.log('✅ Analytics routes loaded');
} catch (err) {
  console.log('❌ analyticsRoutes.js not found:', err.message);
}

// Feature routes (Google Drive integration)
let fileRoutes, googleDriveRoutes;
try {
  fileRoutes = require("./routes/fileRoutes");
  console.log('✅ File upload routes loaded');
} catch (err) {
  console.log('⚠️  fileRoutes.js not found - file upload features disabled');
}

try {
  googleDriveRoutes = require("./routes/googleDriveRoutes");
  console.log('✅ Google Drive routes loaded');
} catch (err) {
  console.log('⚠️  googleDriveRoutes.js not found - Google Drive features disabled');
}

// Optional feature routes
let calendarRoutes, messagingRoutes, settingsRoutes, authRoutes;
try {
  calendarRoutes = require("./routes/calendarRoutes");
  console.log('✅ Calendar routes loaded');
} catch (err) {
  console.log('⚠️  calendarRoutes.js not found - calendar features disabled');
}

try {
  messagingRoutes = require("./routes/messagingRoutes");
  console.log('✅ Messaging routes loaded');
} catch (err) {
  console.log('⚠️  messagingRoutes.js not found - messaging features disabled');
}

try {
  settingsRoutes = require("./routes/settingsRoutes");
  console.log('✅ Settings routes loaded');
} catch (err) {
  console.log('⚠️  settingsRoutes.js not found - settings features disabled');
}

try {
  authRoutes = require("./routes/authRoutes");
  console.log('✅ Auth routes loaded');
} catch (err) {
  console.log('⚠️  authRoutes.js not found - using individual auth in faculty/student routes');
}

// ==============================================
// HEALTH CHECK ENDPOINT
// ==============================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.1.0'
  });
});

// ==============================================
// ROUTE MOUNTING
// ==============================================

console.log('🔗 Mounting API routes...');

// Auth routes (if available)
if (authRoutes) {
  app.use("/api/auth", authRoutes);
  console.log('✅ Auth routes mounted at /api/auth');
}

// Core user routes
if (facultyRoutes) {
  app.use("/api/faculty", facultyRoutes);
  console.log('✅ Faculty routes mounted at /api/faculty');
}

if (studentRoutes) {
  app.use("/api/student", studentRoutes);
  app.use("/api/students", studentRoutes); // Alternative mounting
  console.log('✅ Student routes mounted at /api/student and /api/students');
}

// Project management routes
if (projectServerRoutes) {
  app.use("/api/servers", projectServerRoutes);
  app.use("/api/projectServers", projectServerRoutes); // Alternative mounting
  console.log('✅ Project server routes mounted at /api/servers and /api/projectServers');
}

if (teamRoutes) {
  app.use("/api/teams", teamRoutes);
  app.use("/api/teamRoutes", teamRoutes); // Alternative mounting for existing frontend
  console.log('✅ Team routes mounted at /api/teams and /api/teamRoutes');
}

if (taskRoutes) {
  app.use("/api/tasks", taskRoutes);
  console.log('✅ Task routes mounted at /api/tasks');
}

// System routes
if (notificationRoutes) {
  app.use("/api/notifications", notificationRoutes);
  console.log('✅ Notification routes mounted at /api/notifications');
}

if (analyticsRoutes) {
  app.use("/api/analytics", analyticsRoutes);
  console.log('✅ Analytics routes mounted at /api/analytics');
}

// Google Drive integration routes
if (fileRoutes) {
  app.use("/api/files", fileRoutes);
  console.log('✅ File upload routes mounted at /api/files');
}

if (googleDriveRoutes) {
  app.use("/api/drive", googleDriveRoutes);
  console.log('✅ Google Drive routes mounted at /api/drive');
}

// Optional feature routes
if (calendarRoutes) {
  app.use("/api/calendar", calendarRoutes);
  console.log('✅ Calendar routes mounted at /api/calendar');
}

if (messagingRoutes) {
  app.use("/api/messaging", messagingRoutes);
  console.log('✅ Messaging routes mounted at /api/messaging');
}

if (settingsRoutes) {
  app.use("/api/settings", settingsRoutes);
  console.log('✅ Settings routes mounted at /api/settings');
}

// ==============================================
// API DOCUMENTATION ENDPOINT
// ==============================================

app.get('/', (req, res) => {
  res.json({
    message: 'Project Management API Server with Google Drive Integration',
    version: '2.1.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      authentication: !!(facultyRoutes && studentRoutes),
      projectManagement: !!(projectServerRoutes && teamRoutes && taskRoutes),
      googleDriveIntegration: !!fileRoutes,
      notifications: !!notificationRoutes,
      analytics: !!analyticsRoutes,
      realTime: !!io,
      calendar: !!calendarRoutes,
      messaging: !!messagingRoutes,
      settings: !!settingsRoutes
    },
    endpoints: {
      core: {
        health: 'GET /api/health',
        auth: authRoutes ? '/api/auth/*' : 'Integrated in faculty/student routes',
        faculty: facultyRoutes ? '/api/faculty/*' : 'disabled',
        students: studentRoutes ? '/api/student/*' : 'disabled',
        servers: projectServerRoutes ? '/api/servers/*' : 'disabled',
        teams: teamRoutes ? '/api/teams/*' : 'disabled',
        tasks: taskRoutes ? '/api/tasks/*' : 'disabled'
      },
      features: {
        fileUpload: fileRoutes ? 'POST /api/files/upload/:taskId' : 'disabled',
        googleDrive: googleDriveRoutes ? '/api/drive/*' : 'disabled',
        notifications: notificationRoutes ? '/api/notifications/*' : 'disabled',
        analytics: analyticsRoutes ? '/api/analytics/*' : 'disabled',
        calendar: calendarRoutes ? '/api/calendar/*' : 'disabled',
        messaging: messagingRoutes ? '/api/messaging/*' : 'disabled',
        settings: settingsRoutes ? '/api/settings/*' : 'disabled'
      }
    }
  });
});

// ==============================================
// ERROR HANDLING MIDDLEWARE
// ==============================================

// 404 handler for unknown routes
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    suggestion: 'Check API documentation at / or /api/health'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global error handler caught:', err);
  
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      success: false,
      message: 'CORS policy violation - Origin not allowed',
      timestamp: new Date().toISOString()
    });
  }
  
  // File upload errors
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum size is 50MB.'
    });
  }
  
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      success: false,
      message: 'Validation error',
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV !== 'production' ? err.errors : undefined
    });
  }
  
  // MongoDB duplicate key errors
  if (err.code === 11000) {
    return res.status(409).json({ 
      success: false,
      message: 'Duplicate entry - resource already exists',
      timestamp: new Date().toISOString()
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      success: false,
      message: 'Invalid token',
      timestamp: new Date().toISOString()
    });
  }
  
  // Rate limit errors
  if (err.message && err.message.includes('rate limit')) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
      timestamp: new Date().toISOString()
    });
  }
  
  // Default error response
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ 
    success: false,
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ==============================================
// GRACEFUL SHUTDOWN HANDLING
// ==============================================

const gracefulShutdown = (signal) => {
  console.log(`🛑 ${signal} received, shutting down gracefully...`);
  
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
      
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// ==============================================
// SERVER STARTUP
// ==============================================

const serverInstance = server || app;
serverInstance.listen(PORT, () => {
  console.log('\n🎉 SERVER STARTUP COMPLETE');
  console.log('═'.repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API Base URL: http://localhost:${PORT}/api/`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 CORS enabled for development origins`);
  
  // Log feature availability
  console.log('\n📋 Feature Status:');
  console.log(`   🔐 Authentication: ${!!(facultyRoutes && studentRoutes) ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   📊 Project Management: ${!!(projectServerRoutes && teamRoutes && taskRoutes) ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   🗂️ Google Drive Integration: ${!!fileRoutes ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   🔔 Notifications: ${!!notificationRoutes ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   📈 Analytics: ${!!analyticsRoutes ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   ⚡ Real-time (Socket.io): ${!!io ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   📅 Calendar: ${!!calendarRoutes ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   💬 Messaging: ${!!messagingRoutes ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   ⚙️ Settings: ${!!settingsRoutes ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   🛡️ Security Headers: ${!!helmet ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   ⏱️ Rate Limiting: ${!!rateLimit ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   🗜️ Compression: ${!!compression ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   📝 Request Logging: ${!!morgan ? '✅ Enabled' : '❌ Disabled'}`);
  
  console.log('\n🎯 Server ready to handle requests!');
  console.log('═'.repeat(60));
  
  // Test CORS configuration
  console.log('\n🔍 CORS Configuration Test:');
  console.log('   Allowed Origins:', corsOptions.origin.toString());
  console.log('   Credentials:', corsOptions.credentials);
  console.log('   Methods:', corsOptions.methods.join(', '));
});

module.exports = app;