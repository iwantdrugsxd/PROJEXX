// backend/middleware/rateLimiter.js - CREATE THIS FILE
const rateLimit = require('express-rate-limit');

// Upload rate limiter - stricter limits for file uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX) || 20, // Max 20 uploads per 15 minutes
  message: {
    success: false,
    message: 'Too many upload attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚫 Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many upload attempts, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Max 100 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚫 General rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 auth attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚫 Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Download rate limiter - more lenient for file downloads
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 downloads per 15 minutes
  message: {
    success: false,
    message: 'Too many download attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚫 Download rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many download attempts, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

module.exports = {
  uploadLimiter,
  generalLimiter,
  authLimiter,
  downloadLimiter
};