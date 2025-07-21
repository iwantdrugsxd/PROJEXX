// backend/server.js - NO JWT TOKEN - NO CONFIG - SIMPLE VERSION
// ALL APIS WORKING WITHOUT ANY TOKEN VERIFICATION

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const http = require("http");

console.log('🚀 [STARTUP] Starting ProjectFlow Backend Server (No JWT - Simple)...');
console.log('📍 [STARTUP] Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 [STARTUP] Node Version:', process.version);
console.log('💾 [STARTUP] Memory Usage:', process.memoryUsage());

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ==============================================
// SIMPLE LOGGING FUNCTION
// ==============================================

const logWithTimestamp = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const logLevel = level.toUpperCase();
  console.log(`[${timestamp}] [SERVER] [${logLevel}] ${message}`, data ? JSON.stringify(data) : '');
};

// ==============================================
// BASIC SECURITY & MIDDLEWARE
// ==============================================

app.set('trust proxy', 1);
app.set('x-powered-by', false);

// Simple request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// ==============================================
// CORS CONFIGURATION - SIMPLE
// ==============================================

const corsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Origin', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
logWithTimestamp('info', 'CORS configuration applied - All origins allowed');

// ==============================================
// BODY PARSING & MIDDLEWARE - SIMPLE
// ==============================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

logWithTimestamp('info', 'Middleware configured');

// ==============================================
// DATABASE CONNECTION - SIMPLE
// ==============================================

const connectToDatabase = async () => {
  try {
    logWithTimestamp('info', 'Connecting to MongoDB...');
    
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/project_management';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    logWithTimestamp('info', 'MongoDB Connected Successfully', {
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port
    });
    
    // Monitor connection events
    mongoose.connection.on('error', (err) => {
      logWithTimestamp('error', 'MongoDB connection error', { error: err.message });
    });
    
    mongoose.connection.on('disconnected', () => {
      logWithTimestamp('warn', 'MongoDB disconnected');
    });
    
    return true;
    
  } catch (error) {
    logWithTimestamp('error', 'Database connection failed', { error: error.message });
    throw error;
  }
};

// ==============================================
// ROUTE LOADING SYSTEM - SIMPLE
// ==============================================

const routeRegistry = [];
const failedRoutes = [];

const safeLoadRoute = (routePath, routeName, mountPath) => {
  try {
    logWithTimestamp('info', `Loading ${routeName}...`);
    
    // Check if file exists
    const fullPath = path.join(__dirname, routePath + '.js');
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Route file not found: ${fullPath}`);
    }
    
    const route = require(routePath);
    app.use(mountPath, route);
    
    routeRegistry.push({
      name: routeName,
      path: mountPath,
      status: 'loaded',
      filePath: routePath
    });
    
    logWithTimestamp('info', `${routeName} loaded at ${mountPath}`);
    return true;
    
  } catch (error) {
    failedRoutes.push({
      name: routeName,
      path: mountPath,
      error: error.message,
      filePath: routePath
    });
    
    logWithTimestamp('error', `Failed to load ${routeName}`, { 
      error: error.message,
      filePath: routePath 
    });
    return false;
  }
};

// ==============================================
// LOAD ALL ROUTES - NO JWT
// ==============================================

const loadAllRoutes = () => {
  logWithTimestamp('info', 'Starting route loading...');

  // ✅ CORE ROUTES (REQUIRED)
  const serverLoaded = safeLoadRoute('./routes/projectServerRoutes', 'Project Servers', '/api/projectServers');
  const teamLoaded = safeLoadRoute('./routes/teamRoutes', 'Teams', '/api/teams');
  const taskLoaded = safeLoadRoute('./routes/taskRoutes', 'Tasks', '/api/tasks');

  // ✅ AUTH ROUTES (OPTIONAL)
  const facultyLoaded = safeLoadRoute('./routes/facultyRoutes', 'Faculty', '/api/faculty');
  const studentLoaded = safeLoadRoute('./routes/studentRoutes', 'Students', '/api/student');

  // ✅ ADDITIONAL MOUNTING
  if (studentLoaded) {
    try {
      const studentRoutes = require('./routes/studentRoutes');
      app.use('/api/students', studentRoutes);
      logWithTimestamp('info', 'Student routes also mounted at /api/students');
    } catch (err) {
      logWithTimestamp('warn', 'Failed to mount alternative student route');
    }
  }

  if (serverLoaded) {
    try {
      const serverRoutes = require('./routes/projectServerRoutes');
      app.use('/api/servers', serverRoutes);
      logWithTimestamp('info', 'Server routes also mounted at /api/servers');
    } catch (err) {
      logWithTimestamp('warn', 'Failed to mount alternative server route');
    }
  }

  // ✅ SUMMARY
  logWithTimestamp('info', 'Route Loading Summary', {
    totalAttempted: routeRegistry.length + failedRoutes.length,
    successful: routeRegistry.length,
    failed: failedRoutes.length
  });

  if (routeRegistry.length > 0) {
    logWithTimestamp('info', 'Successfully Loaded Routes:');
    routeRegistry.forEach(route => {
      console.log(`   ✅ ${route.name}: ${route.path}`);
    });
  }

  if (failedRoutes.length > 0) {
    logWithTimestamp('warn', 'Failed Routes:');
    failedRoutes.forEach(route => {
      console.log(`   ❌ ${route.name}: ${route.error}`);
    });
  }

  return {
    serverLoaded,
    teamLoaded,
    taskLoaded,
    facultyLoaded,
    studentLoaded,
    totalLoaded: routeRegistry.length,
    totalFailed: failedRoutes.length
  };
};

// ==============================================
// HEALTH CHECK ENDPOINTS - SIMPLE
// ==============================================

app.get(['/health', '/api/health'], async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      version: '3.0.0-no-jwt',
      nodeVersion: process.version,
      authentication: 'DISABLED - No JWT',
      database: {
        status: dbStatus,
        name: mongoose.connection.name || 'N/A',
        host: mongoose.connection.host || 'N/A'
      },
      routes: {
        loaded: routeRegistry.length,
        failed: failedRoutes.length,
        loadedRoutes: routeRegistry.map(r => ({ name: r.name, path: r.path })),
        failedRoutes: failedRoutes.map(r => ({ name: r.name, error: r.error }))
      }
    };
    
    const statusCode = dbStatus === 'connected' && failedRoutes.length === 0 ? 200 : 207;
    res.status(statusCode).json(health);
    
  } catch (error) {
    logWithTimestamp('error', 'Health check failed', { error: error.message });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      authentication: 'DISABLED'
    });
  }
});

// ==============================================
// API DOCUMENTATION ENDPOINT - SIMPLE
// ==============================================

app.get('/', (req, res) => {
  const documentation = {
    name: 'ProjectFlow API Server (No JWT)',
    version: '3.0.0-no-jwt',
    status: 'running',
    timestamp: new Date().toISOString(),
    description: 'Simple project management API without JWT authentication',
    authentication: 'DISABLED - Direct API access without tokens',
    
    database: {
      status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      name: mongoose.connection.db?.databaseName || 'Unknown'
    },
    
    routes: {
      loaded: routeRegistry.length,
      failed: failedRoutes.length,
      endpoints: routeRegistry.map(r => ({
        name: r.name,
        path: r.path,
        status: 'active'
      }))
    },
    
    quickStart: {
      healthCheck: 'GET /api/health',
      studentTasks: 'GET /api/tasks/student-tasks?studentId=YOUR_ID',
      studentTeams: 'GET /api/teams/student-teams?studentId=YOUR_ID',
      studentServers: 'GET /api/projectServers/student-servers?studentId=YOUR_ID',
      createTeam: 'POST /api/teams/createTeam',
      joinServer: 'POST /api/projectServers/join'
    },
    
    usage: {
      authentication: 'None required',
      parameters: 'Include userId/studentId/facultyId in request body or query params',
      cors: 'All origins allowed',
      example: {
        login: 'POST /api/student/login { email, password }',
        getTasks: 'GET /api/tasks/student-tasks?studentId=12345'
      }
    }
  };
  
  if (failedRoutes.length > 0) {
    documentation.errors = failedRoutes.map(r => ({
      route: r.name,
      error: r.error,
      filePath: r.filePath
    }));
  }
  
  res.json(documentation);
});

// ==============================================
// LOAD ROUTES
// ==============================================

let routeResults = null;

// ==============================================
// ERROR HANDLING - SIMPLE
// ==============================================

// Handle unmatched API routes
app.use('/api/*', (req, res) => {
  logWithTimestamp('warn', `Unmatched API route: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.originalUrl}`,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableRoutes: routeRegistry.map(r => r.path),
    help: {
      documentation: 'GET /',
      health: 'GET /api/health'
    }
  });
});

// Handle 404 for non-API routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    suggestion: 'Check the API documentation at /'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logWithTimestamp('error', 'Global error occurred', {
    error: err.message,
    url: req.originalUrl,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV !== 'production' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ==============================================
// GRACEFUL SHUTDOWN - SIMPLE
// ==============================================

const gracefulShutdown = (signal) => {
  logWithTimestamp('info', `Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logWithTimestamp('info', 'HTTP server closed');
    
    mongoose.connection.close(false, () => {
      logWithTimestamp('info', 'MongoDB connection closed');
      process.exit(0);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logWithTimestamp('error', 'Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ==============================================
// SERVER STARTUP - SIMPLE
// ==============================================

const startServer = async () => {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Load routes
    routeResults = loadAllRoutes();
    
    // Start server
    server.listen(PORT, () => {
      console.log('\n' + '═'.repeat(60));
      console.log('🎉 ProjectFlow Backend Server Started (No JWT)!');
      console.log('═'.repeat(60));
      console.log(`🌐 Server: http://localhost:${PORT}`);
      console.log(`📚 Docs: http://localhost:${PORT}/`);
      console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
      console.log(`🔓 Auth: DISABLED - No JWT tokens required`);
      console.log(`🕒 Started: ${new Date().toISOString()}`);
      
      console.log('\n📊 Route Status:');
      console.log(`├── Total Loaded: ${routeResults.totalLoaded}`);
      console.log(`├── Total Failed: ${routeResults.totalFailed}`);
      
      if (routeResults.totalLoaded > 0) {
        console.log('├── Available Routes:');
        routeRegistry.forEach((route, index) => {
          const isLast = index === routeRegistry.length - 1 && failedRoutes.length === 0;
          const prefix = isLast ? '└──' : '├──';
          console.log(`${prefix} 🔓 ${route.name}: ${route.path}`);
        });
      }
      
      if (routeResults.totalFailed > 0) {
        console.log('├── Failed Routes:');
        failedRoutes.forEach((route, index) => {
          const isLast = index === failedRoutes.length - 1;
          const prefix = isLast ? '└──' : '├──';
          console.log(`${prefix} ❌ ${route.name}: ${route.error}`);
        });
      }
      
      console.log('\n🔗 Quick Test URLs:');
      if (routeResults.teamLoaded) {
        console.log('   👥 Teams Health: http://localhost:' + PORT + '/api/teams/health');
      }
      if (routeResults.taskLoaded) {
        console.log('   📝 Tasks Health: http://localhost:' + PORT + '/api/tasks/health');
      }
      if (routeResults.serverLoaded) {
        console.log('   🖥️  Servers Health: http://localhost:' + PORT + '/api/projectServers/health');
      }
      if (routeResults.studentLoaded) {
        console.log('   👨‍🎓 Student Health: http://localhost:' + PORT + '/api/student/health');
      }
      if (routeResults.facultyLoaded) {
        console.log('   👨‍🏫 Faculty Health: http://localhost:' + PORT + '/api/faculty/health');
      }
      
      console.log('\n📈 Usage:');
      console.log('   🔓 No authentication required');
      console.log('   📤 Include userId in request body/query params');
      console.log('   🧪 Use Postman for API testing');
      console.log('   🌐 All CORS origins allowed');
      
      console.log('\n✨ Ready for requests!');
      console.log('═'.repeat(60));
      
      // Show warnings for failed routes
      if (routeResults.totalFailed > 0) {
        console.log('\n⚠️  WARNING: Some routes failed to load!');
        failedRoutes.forEach(route => {
          console.log(`   ❌ ${route.name}: ${route.error}`);
          console.log(`      File: ${route.filePath}`);
        });
        console.log('⚠️  Please fix these files for full functionality\n');
      }
      
      // Test database
      if (mongoose.connection.readyState === 1) {
        logWithTimestamp('info', 'Database connection verified ✅');
      } else {
        logWithTimestamp('warn', 'Database connection not ready ⚠️');
      }
    });
    
  } catch (error) {
    logWithTimestamp('error', 'Failed to start server', { error: error.message });
    process.exit(1);
  }
};

// Start the server
startServer().catch(error => {
  logWithTimestamp('error', 'Fatal startup error', { error: error.message });
  process.exit(1);
});

// Export for testing
module.exports = { app, server };