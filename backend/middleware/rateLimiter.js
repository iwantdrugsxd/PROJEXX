const rateLimit = require('express-rate-limit');

console.log("🔧 [RATE_LIMITER] Loading bulletproof rate limiters...");

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Higher limits for authenticated users
    if (req.user || req.headers.authorization || req.cookies?.token) {
      return 1000; // 1000 requests per 15 minutes for authenticated users
    }
    return 100; // 100 requests per 15 minutes for anonymous users
  },
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    const skipPaths = ['/api/health', '/', '/favicon.ico'];
    return skipPaths.includes(req.originalUrl) || 
           req.originalUrl.startsWith('/uploads') ||
           req.originalUrl.startsWith('/static');
  },
  keyGenerator: (req) => {
    // Use combination of IP and user agent for more accurate limiting
    return `${req.ip}-${req.headers['user-agent']?.substring(0, 50) || 'unknown'}`;
  },
  handler: (req, res) => {
    const timestamp = new Date().toISOString();
    console.warn(`🚫 [RATE_LIMIT] ${timestamp} - IP ${req.ip} exceeded general rate limit on ${req.originalUrl}`);
    
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
      retryAfter: '15 minutes',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp
    });
  }
});

// Authentication-specific rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes per IP
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => {
    // More specific key for auth attempts
    return `auth-${req.ip}-${req.body?.username?.substring(0, 3) || 'anon'}`;
  },
  handler: (req, res) => {
    const timestamp = new Date().toISOString();
    console.warn(`🚫 [AUTH_LIMIT] ${timestamp} - IP ${req.ip} exceeded auth rate limit`);
    
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      timestamp,
      suggestion: 'If you forgot your password, use the password reset feature.'
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
    retryAfter: '15 minutes',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Include user ID if authenticated for per-user limiting
    const userId = req.user?.id || 'anon';
    return `upload-${req.ip}-${userId}`;
  },
  handler: (req, res) => {
    const timestamp = new Date().toISOString();
    console.warn(`🚫 [UPLOAD_LIMIT] ${timestamp} - IP ${req.ip} exceeded upload rate limit`);
    
    res.status(429).json({
      success: false,
      error: 'Too many upload requests, please try again later.',
      retryAfter: '15 minutes',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      timestamp
    });
  }
});

// Registration rate limiter (very strict)
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registration attempts per hour per IP
  message: {
    success: false,
    error: 'Too many registration attempts, please try again later.',
    retryAfter: '1 hour',
    code: 'REGISTRATION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const timestamp = new Date().toISOString();
    console.warn(`🚫 [REG_LIMIT] ${timestamp} - IP ${req.ip} exceeded registration rate limit`);
    
    res.status(429).json({
      success: false,
      error: 'Too many registration attempts, please try again later.',
      retryAfter: '1 hour',
      code: 'REGISTRATION_RATE_LIMIT_EXCEEDED',
      timestamp
    });
  }
});

console.log("✅ [RATE_LIMITER] All rate limiters configured successfully");

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  registrationLimiter
};

