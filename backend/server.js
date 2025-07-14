const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require("cookie-parser");

// Try to load optional dependencies
let rateLimit, helmet;
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

// Try to load dotenv
try {
  require('dotenv').config();
} catch (err) {
  console.log('⚠️  dotenv not installed - using default environment');
}

const app = express();
const PORT = process.env.PORT || 5000;

// importing routes
const FacultyRoutes = require("./routes/facultyRoutes.js");
const StudentRoutes = require("./routes/studentRoutes.js");
const projectServerRoutes = require("./routes/projectServerRoutes");
const teamRoutes = require("./routes/teamRoutes.js");
const taskRoutes = require("./routes/taskRoutes.js");

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
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
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
      console.log('CORS blocked origin:', origin);
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// Request logging (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', req.body);
    }
    next();
  });
}

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({ 
    message: "✅ Backend Server Connected",
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use("/api/faculty", FacultyRoutes);
app.use("/api/student", StudentRoutes);
app.use("/api/projectServers", projectServerRoutes);
app.use("/api/teamRoutes", teamRoutes);
app.use("/api/task", taskRoutes);

// 404 handler
app.use('*', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Route not found:', req.method, req.originalUrl);
  }
  res.status(404).json({ 
    message: 'Route not found', 
    success: false,
    method: req.method, 
    path: req.originalUrl,
    availableRoutes: [
      'GET /',
      'POST /api/faculty/login',
      'POST /api/faculty/register',
      'GET /api/faculty/dashboard',
      'POST /api/student/login',
      'POST /api/student/register',
      'GET /api/student/dashboard',
      'POST /api/projectServers/join',
      'POST /api/projectServers/create',
      'GET /api/projectServers/student-servers',
      'GET /api/projectServers/faculty-servers',
      'GET /api/projectServers/byCode/:code'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      message: 'CORS policy violation',
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
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      message: 'Invalid token',
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

// Connect to MongoDB and start server
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    console.log(`🗄️  Database: ${mongoose.connection.db.databaseName}`);
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 CORS configured for frontend origins`);
      
      if (rateLimit) {
        console.log(`⚡ Security: Rate limiting enabled`);
      }
      if (helmet) {
        console.log(`🛡️  Security: Helmet headers enabled`);
      }
      
      console.log(`📋 Available API endpoints:`);
      console.log(`   Health Check: GET /`);
      console.log(`   Faculty: POST /api/faculty/login, /register, GET /dashboard`);
      console.log(`   Student: POST /api/student/login, /register, GET /dashboard`);
      console.log(`   Project Servers:`);
      console.log(`     POST /api/projectServers/join`);
      console.log(`     POST /api/projectServers/create`);
      console.log(`     GET  /api/projectServers/student-servers`);
      console.log(`     GET  /api/projectServers/faculty-servers`);
      console.log(`     GET  /api/projectServers/byCode/:code`);
      console.log(`     DELETE /api/projectServers/:serverId`);
      console.log(`═══════════════════════════════════════════════════════════`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });