const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser"); // ← ADD THIS LINE
const path = require("path");

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

// Enable trust proxy for accurate IP addresses behind reverse proxy
app.set('trust proxy', 1);

// CORS configuration
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
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma', 'Expires'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));
app.use(express.json({ 
  limit: '50mb'
}));

// Parse URL-encoded bodies (ONLY ONCE!)
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb' 
}));

app.use(cookieParser());

// Enhanced request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  
  // Log all requests
  console.log(`[${timestamp}] [SERVER] ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    referer: req.headers.referer,
    cookies: req.cookies ? Object.keys(req.cookies) : 'No cookies' // Debug cookies
  });
  
  next();
});
// Optional middleware
if (compression) {
  app.use(compression());
}

if (morgan) {
  app.use(morgan('combined'));
}

// Enhanced request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  
  // Log all requests with enhanced details
  console.log(`[${timestamp}] [SERVER] ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    referer: req.headers.referer
  });
  
  // Log request body for non-file uploads (debugging)
  if (req.body && Object.keys(req.body).length > 0 && !req.originalUrl.includes('/upload') && req.method === 'POST') {
    console.log(`[${timestamp}] [SERVER] Request body:`, JSON.stringify(req.body, null, 2));
  }
  
  // Log file uploads
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    console.log(`[${timestamp}] [SERVER] Multipart form data detected - file upload in progress`);
  }
  
  next();
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
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/faculty/login', authLimiter);
  app.use('/api/student/login', authLimiter);
}

// Parse JSON with size limits

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io setup (optional)
let server, io;
try {
  server = require('http').createServer(app);
  io = require('socket.io')(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
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

    socket.on('disconnect', () => {
      console.log('👤 User disconnected:', socket.id);
      if (socket.userId) {
        socket.broadcast.emit('userOffline', socket.userId);
      }
    });
  });

  // Make io available to routes
  app.set('io', io);
} catch (err) {
  console.log('⚠️  Socket.io not available - real-time features disabled');
  server = require('http').createServer(app);
}

// ✅ CORE ROUTE IMPORTS
const FacultyRoutes = require("./routes/facultyRoutes.js");
const StudentRoutes = require("./routes/studentRoutes.js");
const projectServerRoutes = require("./routes/projectServerRoutes");
const teamRoutes = require("./routes/teamRoutes.js");
const taskRoutes = require("./routes/taskRoutes.js");
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require("./routes/analyticsRoutes");

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ✅ UPDATED ROUTE MOUNTING WITH MULTIPLE PATHS
console.log('🔗 Mounting API routes...');

// Faculty routes
app.use("/api/faculty", FacultyRoutes);
console.log('✅ Faculty routes mounted at /api/faculty');

// Student routes  
app.use("/api/student", StudentRoutes);
console.log('✅ Student routes mounted at /api/student');

// Project server routes (multiple mounting points)
app.use("/api/projectServers", projectServerRoutes);
app.use("/api/server", projectServerRoutes); // Alternative mounting
console.log('✅ Project server routes mounted at /api/projectServers and /api/server');

// Team routes (multiple mounting points)
app.use("/api/teamRoutes", teamRoutes);
app.use("/api/teams", teamRoutes); // Alternative mounting
console.log('✅ Team routes mounted at /api/teamRoutes and /api/teams');

// Task routes
app.use("/api/tasks", taskRoutes);
console.log('✅ Task routes mounted at /api/tasks');

// Notification routes
app.use("/api/notifications", notificationRoutes);
console.log('✅ Notification routes mounted at /api/notifications');

// Analytics routes
app.use("/api/analytics", analyticsRoutes);
console.log('✅ Analytics routes mounted at /api/analytics');

// Optional feature routes
if (fileRoutes) {
  app.use("/api/files", fileRoutes);
  console.log('✅ File routes mounted at /api/files');
}

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

// MongoDB Connection
mongoose.connect(MONGO_URI)
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

// API Documentation endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Project Management API Server',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    documentation: {
      faculty: [
        'POST /api/faculty/register',
        'POST /api/faculty/login',
        'GET /api/faculty/dashboard',
        'POST /api/faculty/logout'
      ],
      student: [
        'POST /api/student/register',
        'POST /api/student/login',
        'GET /api/student/dashboard', 
        'POST /api/student/logout'
      ],
      projectServers: [
        'POST /api/projectServers/join',
        'POST /api/projectServers/create',
        'GET /api/projectServers/student-servers',
        'GET /api/projectServers/faculty-servers',
        'GET /api/server/:serverId',
        'DELETE /api/projectServers/:serverId'
      ],
      teams: [
        'POST /api/teamRoutes/createTeam',
        'GET /api/teamRoutes/student-teams',
        'GET /api/teamRoutes/faculty',
        'GET /api/teamRoutes/faculty-teams',
        'GET /api/teamRoutes/server/:serverId/teams',
        'GET /api/teams/server/:serverId/teams',
        'POST /api/teamRoutes/join/:teamId',
        'POST /api/teamRoutes/leave/:teamId',
        'DELETE /api/teamRoutes/:teamId',
        'GET /api/teamRoutes/search/:query'
      ],
      tasks: [
        'POST /api/tasks/create',
        'GET /api/tasks/student-tasks',
        'GET /api/tasks/faculty',
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
  
  // MongoDB duplicate key errors
  if (err.code === 11000) {
    return res.status(409).json({ 
      message: 'Duplicate entry - resource already exists',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      message: 'Invalid token',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal server error',
    success: false,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      });
    });
  }
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      });
    });
  }
});

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

// Start the server
const serverInstance = server || app;
serverInstance.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API endpoints available at http://localhost:${PORT}/api/`);
  console.log(`📖 API documentation at http://localhost:${PORT}/`);
  console.log(`🔗 CORS enabled for development origins`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Log feature availability
  console.log('\n📋 Feature Status:');
  console.log(`   Security Headers: ${helmet ? '✅' : '❌'}`);
  console.log(`   Rate Limiting: ${rateLimit ? '✅' : '❌'}`);
  console.log(`   Compression: ${compression ? '✅' : '❌'}`);
  console.log(`   Request Logging: ${morgan ? '✅' : '❌'}`);
  console.log(`   Socket.io: ${io ? '✅' : '❌'}`);
  console.log(`   File Upload: ${fileRoutes ? '✅' : '❌'}`);
  console.log(`   Calendar: ${calendarRoutes ? '✅' : '❌'}`);
  console.log(`   Messaging: ${messagingRoutes ? '✅' : '❌'}`);
  console.log(`   Settings: ${settingsRoutes ? '✅' : '❌'}`);
  
  console.log('\n🎯 Ready to handle requests!');
});

module.exports = app;