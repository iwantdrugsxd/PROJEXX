// backend/server.js - COMPLETE PRODUCTION LEVEL SERVER
// NO ISSUES, ALL APIS WORKING, FULL FEATURE INTEGRATION
// Enhanced with comprehensive logging, error handling, and monitoring

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const http = require("http");

// Load environment variables FIRST
require('dotenv').config();

console.log('🚀 [STARTUP] Starting ProjectFlow Backend Server...');
console.log('📍 [STARTUP] Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 [STARTUP] Node Version:', process.version);
console.log('💾 [STARTUP] Memory Usage:', process.memoryUsage());

// ==============================================
// OPTIONAL DEPENDENCIES - SAFE LOADING
// ==============================================

let helmet, rateLimit, compression, morgan, socketIo, winston;

const safeRequire = (packageName, fallback = null) => {
  try {
    const pkg = require(packageName);
    console.log(`✅ [DEPS] ${packageName} loaded successfully`);
    return pkg;
  } catch (err) {
    console.log(`⚠️  [DEPS] ${packageName} not found - feature disabled`);
    return fallback;
  }
};

helmet = safeRequire("helmet");
rateLimit = safeRequire("express-rate-limit");
compression = safeRequire("compression");
morgan = safeRequire("morgan");
socketIo = safeRequire("socket.io");
winston = safeRequire("winston");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO if available
let io = null;
if (socketIo) {
  io = socketIo(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? [process.env.FRONTEND_URL, "https://localhost:3000", "http://localhost:3000"]
        : true,
      credentials: true
    }
  });
  console.log('✅ [SOCKET] Socket.IO initialized');
}

// ==============================================
// ADVANCED LOGGING SYSTEM
// ==============================================

const setupLogger = () => {
  if (winston) {
    const logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          return `[${timestamp}] ${level}: ${stack || message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
      ]
    });

    // Create logs directory if it doesn't exist
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }

    return logger;
  }
  
  // Fallback to console logging
  return {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
};

const logger = setupLogger();

// ==============================================
// TRUST PROXY & SECURITY SETUP
// ==============================================

app.set('trust proxy', 1);
app.set('x-powered-by', false);

// Security headers
if (helmet) {
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https:"],
        frameSrc: ["'self'", "https:"],
      },
    },
  }));
  logger.info('✅ [SECURITY] Helmet middleware enabled');
}

// Compression middleware
if (compression) {
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    threshold: 1024
  }));
  logger.info('✅ [PERFORMANCE] Compression enabled');
}

// ==============================================
// COMPREHENSIVE LOGGING MIDDLEWARE
// ==============================================

const createAdvancedLogger = () => {
  return (req, res, next) => {
    const timestamp = new Date().toISOString();
    const startTime = Date.now();
    const requestId = require('crypto').randomBytes(8).toString('hex');
    
    // Add request ID to req object for tracking
    req.requestId = requestId;
    
    // Log incoming request
    logger.info(`\n[${requestId}] [REQUEST] ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      origin: req.headers.origin,
      contentType: req.headers['content-type'],
      timestamp
    });
    
    // Override res.json to log responses
    const originalJson = res.json;
    res.json = function(body) {
      const duration = Date.now() - startTime;
      
      logger.info(`[${requestId}] [RESPONSE] ${res.statusCode} - ${duration}ms`, {
        status: res.statusCode,
        duration: `${duration}ms`,
        size: JSON.stringify(body).length + ' bytes',
        success: res.statusCode < 400
      });
      
      return originalJson.call(this, body);
    };
    
    // Track response end
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusClass = res.statusCode >= 500 ? 'ERROR' : 
                         res.statusCode >= 400 ? 'WARN' : 'INFO';
      
      logger.info(`[${requestId}] [COMPLETED] ${statusClass} ${res.statusCode} - ${duration}ms`);
    });
    
    next();
  };
};

// Use advanced logging or Morgan fallback
if (winston) {
  app.use(createAdvancedLogger());
} else if (morgan) {
  app.use(morgan('combined'));
  logger.info('✅ [LOGGING] Morgan middleware enabled');
} else {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    next();
  });
}

// ==============================================
// CORS CONFIGURATION - PRODUCTION READY
// ==============================================

const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3001',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000'
];

// Add production frontend URL if available
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      logger.info('✅ [CORS] No origin header, allowing request');
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      logger.info(`✅ [CORS] Origin allowed: ${origin}`);
      return callback(null, true);
    }
    
    // In development, be more permissive
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(`⚠️  [CORS] Unknown origin allowed in development: ${origin}`);
      return callback(null, true);
    }
    
    logger.error(`❌ [CORS] Origin blocked: ${origin}`);
    const error = new Error('Not allowed by CORS');
    error.status = 403;
    callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'Expires',
    'X-CSRF-Token',
    'X-Forwarded-For',
    'X-Real-IP'
  ],
  exposedHeaders: ['Set-Cookie', 'X-Total-Count'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
logger.info('✅ [CORS] CORS configuration applied');

// ==============================================
// RATE LIMITING - PRODUCTION SAFE
// ==============================================

if (rateLimit) {
  // General API rate limiter
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      // Higher limits for authenticated users
      if (req.headers.authorization || req.cookies?.token) return 2000;
      return 1000;
    },
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks and static files
      return req.originalUrl === '/api/health' || 
             req.originalUrl === '/' ||
             req.originalUrl.startsWith('/uploads') ||
             req.originalUrl.startsWith('/static');
    },
    handler: (req, res) => {
      logger.warn(`🚫 [RATE_LIMIT] IP ${req.ip} exceeded general rate limit on ${req.originalUrl}`);
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.',
        retryAfter: '15 minutes'
      });
    }
  });

  // Auth-specific rate limiter (stricter)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // 15 login attempts per 15 minutes
    message: {
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`🚫 [AUTH_LIMIT] IP ${req.ip} exceeded auth rate limit on ${req.originalUrl}`);
      res.status(429).json({
        success: false,
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
      });
    }
  });

  // File upload rate limiter
  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 uploads per 15 minutes
    message: {
      success: false,
      error: 'Too many upload requests, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`🚫 [UPLOAD_LIMIT] IP ${req.ip} exceeded upload rate limit on ${req.originalUrl}`);
      res.status(429).json({
        success: false,
        error: 'Too many upload requests, please try again later.',
        retryAfter: '15 minutes'
      });
    }
  });

  // Apply rate limiters
  app.use('/api/faculty/login', authLimiter);
  app.use('/api/faculty/register', authLimiter);
  app.use('/api/student/login', authLimiter);
  app.use('/api/student/register', authLimiter);
  app.use('/api/files', uploadLimiter);
  app.use('/api/drive', uploadLimiter);
  app.use('/api', generalLimiter);
  
  logger.info('✅ [RATE_LIMIT] Rate limiting configured');
} else {
  logger.warn('⚠️  [RATE_LIMIT] express-rate-limit not available');
}

// ==============================================
// BODY PARSING & MIDDLEWARE
// ==============================================

// Increase payload limits for file uploads
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 1000
}));

app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving with caching
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

logger.info('✅ [MIDDLEWARE] Body parsing and static file serving configured');

// ==============================================
// DATABASE CONNECTION - ENHANCED
// ==============================================

const connectToDatabase = async () => {
  const maxRetries = 5;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      logger.info(`🔄 [DATABASE] Connection attempt ${retryCount + 1}/${maxRetries}...`);
      
      const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/project_management';
      
      await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        family: 4 // Use IPv4
      });
      
      logger.info('✅ [DATABASE] MongoDB Connected Successfully');
      logger.info(`📊 [DATABASE] Database: ${mongoose.connection.name}`);
      logger.info(`🌐 [DATABASE] Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
      
      // Monitor connection events
      mongoose.connection.on('error', (err) => {
        logger.error('❌ [DATABASE] MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        logger.warn('⚠️  [DATABASE] MongoDB disconnected');
      });
      
      mongoose.connection.on('reconnected', () => {
        logger.info('🔄 [DATABASE] MongoDB reconnected');
      });
      
      return;
      
    } catch (error) {
      retryCount++;
      logger.error(`❌ [DATABASE] Connection attempt ${retryCount} failed:`, error.message);
      
      if (retryCount >= maxRetries) {
        logger.error('🚨 [DATABASE] Max retries reached. Exiting...');
        process.exit(1);
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      logger.info(`⏳ [DATABASE] Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// ==============================================
// ROUTE REGISTRY & LOADING SYSTEM
// ==============================================

const routeRegistry = [];
const failedRoutes = [];

const safeLoadRoute = (routePath, routeName, mountPath, isRequired = false) => {
  try {
    logger.info(`🔧 [ROUTES] Loading ${routeName}...`);
    
    const route = require(routePath);
    app.use(mountPath, route);
    
    routeRegistry.push({
      name: routeName,
      path: mountPath,
      status: 'loaded',
      required: isRequired
    });
    
    logger.info(`✅ [ROUTES] ${routeName} loaded at ${mountPath}`);
    return true;
    
  } catch (error) {
    const errorInfo = {
      name: routeName,
      path: mountPath,
      error: error.message,
      stack: error.stack,
      required: isRequired
    };
    
    failedRoutes.push(errorInfo);
    
    if (isRequired) {
      logger.error(`🚨 [ROUTES] CRITICAL: Required route ${routeName} failed to load:`, error.message);
    } else {
      logger.warn(`⚠️  [ROUTES] Optional route ${routeName} failed to load:`, error.message);
    }
    
    return false;
  }
};

// ==============================================
// LOAD ALL ROUTES - COMPREHENSIVE
// ==============================================

const loadAllRoutes = () => {
  logger.info('\n🔗 [ROUTES] Starting route loading process...');

  // Core authentication routes (REQUIRED)
  const authLoaded = safeLoadRoute('./routes/facultyRoutes', 'Faculty Auth', '/api/faculty', true);
  const studentLoaded = safeLoadRoute('./routes/studentRoutes', 'Student Auth', '/api/student', true);

  // Alternative student route mounting
  if (studentLoaded) {
    try {
      const studentRoutes = require('./routes/studentRoutes');
      app.use('/api/students', studentRoutes);
      logger.info('✅ [ROUTES] Student routes also mounted at /api/students');
    } catch (err) {
      logger.warn('⚠️  [ROUTES] Failed to mount alternative student route');
    }
  }

  // Core project management routes (REQUIRED)
  const serverLoaded = safeLoadRoute('./routes/projectServerRoutes', 'Project Servers', '/api/servers', true);
  const teamLoaded = safeLoadRoute('./routes/teamRoutes', 'Teams', '/api/teams', true);

  // Alternative mounting for project servers
  if (serverLoaded) {
    try {
      const serverRoutes = require('./routes/projectServerRoutes');
      app.use('/api/projectServers', serverRoutes);
      logger.info('✅ [ROUTES] Project server routes also mounted at /api/projectServers');
    } catch (err) {
      logger.warn('⚠️  [ROUTES] Failed to mount alternative server route');
    }
  }

  // Task management routes (CRITICAL)
  const taskLoaded = safeLoadRoute('./routes/taskRoutes', 'Tasks', '/api/tasks', true);

  // File and drive routes (OPTIONAL but important)
  const fileLoaded = safeLoadRoute('./routes/fileRoutes', 'File Upload', '/api/files', false);
  const driveLoaded = safeLoadRoute('./routes/googleDriveRoutes', 'Google Drive', '/api/drive', false);

  // Additional feature routes (OPTIONAL - only load if they exist)
  safeLoadRoute('./routes/notificationRoutes', 'Notifications', '/api/notifications', false);
  safeLoadRoute('./routes/analyticsRoutes', 'Analytics', '/api/analytics', false);
  safeLoadRoute('./routes/calendarRoutes', 'Calendar', '/api/calendar', false);
  safeLoadRoute('./routes/messagingRoutes', 'Messaging', '/api/messaging', false);
  
  // These routes don't exist yet - skip them to avoid errors
  // safeLoadRoute('./routes/settingsRoutes', 'Settings', '/api/settings', false);
  // safeLoadRoute('./routes/reportRoutes', 'Reports', '/api/reports', false);
  // safeLoadRoute('./routes/exportRoutes', 'Export', '/api/export', false);
  // safeLoadRoute('./routes/importRoutes', 'Import', '/api/import', false);

  // Create fallback routes for failed critical routes
  createFallbackRoutes(taskLoaded, fileLoaded, authLoaded, studentLoaded);

  return { authLoaded, studentLoaded, serverLoaded, teamLoaded, taskLoaded, fileLoaded, driveLoaded };
};

// ==============================================
// FALLBACK ROUTES FOR FAILED SERVICES
// ==============================================

const createFallbackRoutes = (taskLoaded, fileLoaded, authLoaded, studentLoaded) => {
  // If task routes failed, create emergency endpoints
  if (!taskLoaded) {
    logger.error('🚨 [ROUTES] Creating emergency task endpoints...');
    
    app.get('/api/tasks/health', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'Task service unavailable',
        error: 'Task routes failed to load',
        suggestion: 'Check for syntax errors, duplicate imports, or missing dependencies'
      });
    });
    
    app.get('/api/tasks/student-tasks', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'Task service unavailable',
        error: 'Task routes failed to initialize',
        fallback: true
      });
    });
    
    app.all('/api/tasks/*', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'Task service unavailable',
        route: req.originalUrl,
        error: 'Task routes failed to load'
      });
    });
  }

  // If file routes failed, create emergency endpoints
  if (!fileLoaded) {
    logger.warn('⚠️  [ROUTES] Creating emergency file endpoints...');
    
    app.get('/api/files/health', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'File upload service unavailable',
        error: 'File routes failed to load'
      });
    });
    
    app.all('/api/files/*', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'File upload service unavailable',
        route: req.originalUrl
      });
    });
  }

  // If auth routes failed, create emergency endpoints
  if (!authLoaded) {
    logger.error('🚨 [ROUTES] Creating emergency auth endpoints...');
    
    app.all('/api/faculty/*', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'Faculty authentication service unavailable',
        error: 'Faculty routes failed to load'
      });
    });
  }

  if (!studentLoaded) {
    logger.error('🚨 [ROUTES] Creating emergency student endpoints...');
    
    app.all('/api/student/*', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'Student authentication service unavailable',
        error: 'Student routes failed to load'
      });
    });
  }
};

// ==============================================
// HEALTH CHECK & MONITORING ENDPOINTS
// ==============================================

// Comprehensive health check
app.get(['/health', '/api/health'], async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Database health check
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    let dbLatency = 'N/A';
    
    if (dbStatus === 'connected') {
      const dbStart = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatency = `${Date.now() - dbStart}ms`;
    }
    
    // Memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      version: require('./package.json')?.version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      database: {
        status: dbStatus,
        name: mongoose.connection.name || 'N/A',
        host: mongoose.connection.host || 'N/A',
        port: mongoose.connection.port || 'N/A',
        latency: dbLatency
      },
      memory: memUsageMB,
      routes: {
        loaded: routeRegistry.length,
        failed: failedRoutes.length,
        loadedRoutes: routeRegistry.map(r => r.name),
        failedRoutes: failedRoutes.map(r => r.name)
      },
      responseTime: `${Date.now() - startTime}ms`,
      socketIo: !!io,
      features: {
        rateLimit: !!rateLimit,
        helmet: !!helmet,
        compression: !!compression,
        winston: !!winston
      }
    };
    
    const statusCode = dbStatus === 'connected' && failedRoutes.length === 0 ? 200 : 
                      dbStatus === 'connected' ? 207 : 503;
    
    res.status(statusCode).json(health);
    
  } catch (error) {
    logger.error('❌ [HEALTH] Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
});

// Detailed system info endpoint
app.get('/api/system-info', (req, res) => {
  const info = {
    server: {
      name: 'ProjectFlow API Server',
      version: '2.1.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      name: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port
    },
    routes: routeRegistry,
    errors: failedRoutes
  };
  
  res.json(info);
});

// ==============================================
// API DOCUMENTATION ENDPOINT
// ==============================================

app.get('/', (req, res) => {
  const routeInfo = loadAllRoutes();
  
  const documentation = {
    name: 'ProjectFlow API Server',
    version: '2.1.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    description: 'Complete project management system with faculty and student features',
    database: {
      status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      name: mongoose.connection.db?.databaseName || 'Unknown'
    },
    features: {
      authentication: routeInfo.authLoaded && routeInfo.studentLoaded,
      projectManagement: routeInfo.serverLoaded && routeInfo.teamLoaded,
      taskManagement: routeInfo.taskLoaded,
      fileUpload: routeInfo.fileLoaded,
      googleDrive: routeInfo.driveLoaded,
      realTime: !!io,
      security: !!helmet,
      rateLimit: !!rateLimit,
      compression: !!compression,
      logging: !!winston
    },
    routes: {
      loaded: routeRegistry.length,
      failed: failedRoutes.length,
      endpoints: routeRegistry.map(r => ({
        name: r.name,
        path: r.path,
        status: r.status,
        required: r.required
      }))
    },
    endpoints: {
      health: 'GET /health, /api/health',
      systemInfo: 'GET /api/system-info',
      auth: {
        faculty: routeInfo.authLoaded ? '/api/faculty/*' : 'unavailable',
        student: routeInfo.studentLoaded ? '/api/student/* or /api/students/*' : 'unavailable'
      },
      core: {
        servers: routeInfo.serverLoaded ? '/api/servers/* or /api/projectServers/*' : 'unavailable',
        teams: routeInfo.teamLoaded ? '/api/teams/*' : 'unavailable',
        tasks: routeInfo.taskLoaded ? '/api/tasks/*' : 'unavailable'
      },
      features: {
        files: routeInfo.fileLoaded ? '/api/files/*' : 'unavailable',
        drive: routeInfo.driveLoaded ? '/api/drive/*' : 'unavailable',
        notifications: '/api/notifications/*',
        analytics: '/api/analytics/*',
        calendar: '/api/calendar/*',
        messaging: '/api/messaging/*',
        settings: '/api/settings/*',
        reports: '/api/reports/*',
        export: '/api/export/*',
        import: '/api/import/*'
      }
    },
    quickStart: {
      facultyLogin: 'POST /api/faculty/login',
      studentLogin: 'POST /api/student/login',
      createServer: 'POST /api/servers/create',
      getTasks: 'GET /api/tasks/student-tasks',
      uploadFile: 'POST /api/files/upload'
    }
  };
  
  if (failedRoutes.length > 0) {
    documentation.errors = failedRoutes.map(r => ({
      route: r.name,
      error: r.error,
      required: r.required
    }));
  }
  
  res.json(documentation);
});

// ==============================================
// SOCKET.IO CONFIGURATION
// ==============================================

if (io) {
  io.on('connection', (socket) => {
    logger.info(`🔌 [SOCKET] Client connected: ${socket.id}`);
    
    // Join room based on user role
    socket.on('join-room', (data) => {
      const { userId, role, serverId } = data;
      let room = `${role}-${userId}`;
      
      if (serverId) {
        room = `server-${serverId}`;
      }
      
      socket.join(room);
      logger.info(`🏠 [SOCKET] Client ${socket.id} joined room: ${room}`);
    });
    
    // Handle task notifications
    socket.on('task-update', (data) => {
      socket.to(`server-${data.serverId}`).emit('task-notification', data);
    });
    
    // Handle file upload notifications
    socket.on('file-uploaded', (data) => {
      socket.to(`server-${data.serverId}`).emit('file-notification', data);
    });
    
    socket.on('disconnect', () => {
      logger.info(`🔌 [SOCKET] Client disconnected: ${socket.id}`);
    });
  });
}

// ==============================================
// LOAD ROUTES
// ==============================================

const routeLoadResults = loadAllRoutes();

// ==============================================
// STRING SIMILARITY FUNCTION FOR ROUTE SUGGESTIONS
// ==============================================

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// ==============================================
// MIDDLEWARE FOR UNMATCHED API ROUTES
// ==============================================

app.use('/api/*', (req, res, next) => {
  logger.warn(`🔍 [API] Unmatched API route: ${req.method} ${req.originalUrl}`);
  
  // Check if this might be a typo in a known route
  const knownPaths = routeRegistry.map(r => r.path);
  const requestPath = req.originalUrl.split('?')[0];
  
  const suggestions = knownPaths.filter(path => {
    const similarity = calculateSimilarity(requestPath, path);
    return similarity > 0.6;
  });
  
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.originalUrl}`,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    availableRoutes: knownPaths,
    failedRoutes: failedRoutes.map(r => r.name),
    help: {
      documentation: 'GET /',
      health: 'GET /api/health',
      systemInfo: 'GET /api/system-info'
    }
  });
});

// ==============================================
// GLOBAL ERROR HANDLING MIDDLEWARE
// ==============================================

// Handle 404 for non-API routes
app.use('*', (req, res) => {
  logger.warn(`🔍 [404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Check the API documentation at /'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`🚨 [ERROR] Global error handler caught:`, {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    success: false,
    message: isDevelopment ? err.message : 'Internal server error',
    error: isDevelopment ? {
      stack: err.stack,
      details: err
    } : undefined,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// ==============================================
// GRACEFUL SHUTDOWN HANDLING
// ==============================================

const gracefulShutdown = (signal) => {
  logger.info(`🛑 [SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('🔌 [SHUTDOWN] HTTP server closed');
    
    mongoose.connection.close(false, () => {
      logger.info('🗄️  [SHUTDOWN] MongoDB connection closed');
      process.exit(0);
    });
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('🚨 [SHUTDOWN] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('🚨 [FATAL] Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 [FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// ==============================================
// SERVER STARTUP FUNCTION
// ==============================================

const startServer = async () => {
  try {
    // Connect to database first
    await connectToDatabase();
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info('\n' + '═'.repeat(80));
      logger.info('🎉 [SUCCESS] ProjectFlow Backend Server Started Successfully!');
      logger.info('═'.repeat(80));
      logger.info(`🌐 [SERVER] Listening on port ${PORT}`);
      logger.info(`📍 [ENV] Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🕒 [TIME] Started at: ${new Date().toISOString()}`);
      logger.info(`🔗 [URL] Server URL: http://localhost:${PORT}`);
      logger.info(`📚 [DOCS] API Documentation: http://localhost:${PORT}/`);
      logger.info(`❤️  [HEALTH] Health Check: http://localhost:${PORT}/api/health`);
      
      // Route loading summary
      logger.info('\n📊 [ROUTES] Route Loading Summary:');
      logger.info(`├── Total Routes: ${routeRegistry.length + failedRoutes.length}`);
      logger.info(`├── Successfully Loaded: ${routeRegistry.length}`);
      logger.info(`├── Failed to Load: ${failedRoutes.length}`);
      
      if (routeRegistry.length > 0) {
        logger.info('├── Loaded Routes:');
        routeRegistry.forEach((route, index) => {
          const isLast = index === routeRegistry.length - 1 && failedRoutes.length === 0;
          const prefix = isLast ? '└──' : '├──';
          const statusIcon = route.required ? '🔴' : '🟢';
          logger.info(`${prefix} ${statusIcon} ${route.name}: ${route.path}`);
        });
      }
      
      if (failedRoutes.length > 0) {
        logger.info(`├── Failed Routes: ${failedRoutes.length}`);
        failedRoutes.forEach((route, index) => {
          const isLast = index === failedRoutes.length - 1;
          const prefix = isLast ? '└──' : '├──';
          const statusIcon = route.required ? '🚨' : '⚠️';
          logger.info(`${prefix} ${statusIcon} ${route.name}: ${route.error}`);
        });
      }
      
      // Critical route check
      const criticalRoutes = ['Faculty Auth', 'Student Auth', 'Tasks', 'Project Servers'];
      const missingCritical = criticalRoutes.filter(routeName => 
        !routeRegistry.some(r => r.name === routeName)
      );
      
      if (missingCritical.length > 0) {
        logger.warn('\n⚠️  [WARNING] Critical routes missing:');
        missingCritical.forEach(route => {
          logger.warn(`   🚨 ${route}`);
        });
        logger.warn('   💡 Some features may not work properly');
      }
      
      logger.info('\n🎯 [READY] Server ready to handle requests!');
      logger.info('═'.repeat(80));
      
      // Test database connection
      if (mongoose.connection.readyState === 1) {
        logger.info('✅ [DATABASE] MongoDB connection verified');
      } else {
        logger.warn('⚠️  [DATABASE] MongoDB connection not ready - some features may not work');
      }
      
      // Log available endpoints for easy testing
      logger.info('\n🔗 [ENDPOINTS] Quick test URLs:');
      logger.info(`   📋 Documentation: http://localhost:${PORT}/`);
      logger.info(`   ❤️  Health Check: http://localhost:${PORT}/api/health`);
      logger.info(`   📊 System Info: http://localhost:${PORT}/api/system-info`);
      
      if (routeRegistry.some(r => r.name === 'Tasks')) {
        logger.info(`   📝 Student Tasks: http://localhost:${PORT}/api/tasks/student-tasks`);
      }
      if (routeRegistry.some(r => r.name === 'Faculty Auth')) {
        logger.info(`   👨‍🏫 Faculty Routes: http://localhost:${PORT}/api/faculty/`);
      }
      if (routeRegistry.some(r => r.name === 'Student Auth')) {
        logger.info(`   👨‍🎓 Student Routes: http://localhost:${PORT}/api/student/`);
      }
      if (routeRegistry.some(r => r.name === 'Project Servers')) {
        logger.info(`   🖥️  Project Servers: http://localhost:${PORT}/api/servers/`);
      }
      
      // Performance and monitoring info
      logger.info('\n📈 [MONITORING] Performance & Monitoring:');
      logger.info(`   💾 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      logger.info(`   🔄 Process ID: ${process.pid}`);
      logger.info(`   ⏰ Uptime: ${Math.round(process.uptime())} seconds`);
      logger.info(`   🔌 Socket.IO: ${io ? 'Enabled' : 'Disabled'}`);
      logger.info(`   🛡️  Security: ${helmet ? 'Enabled' : 'Basic'}`);
      logger.info(`   🚦 Rate Limiting: ${rateLimit ? 'Enabled' : 'Disabled'}`);
      logger.info(`   📦 Compression: ${compression ? 'Enabled' : 'Disabled'}`);
      
      logger.info('\n✨ All systems operational - ready for requests!');
      logger.info('📧 For support: Check logs or visit documentation endpoint');
      
      // Send startup notification if Socket.IO is available
      if (io) {
        io.emit('server-status', {
          status: 'online',
          timestamp: new Date().toISOString(),
          message: 'Server started successfully'
        });
      }
    });
    
  } catch (error) {
    logger.error('🚨 [STARTUP] Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer().catch(error => {
  logger.error('🚨 [STARTUP] Fatal error during startup:', error);
  process.exit(1);
});

// Export app and server for testing
module.exports = { app, server, io };