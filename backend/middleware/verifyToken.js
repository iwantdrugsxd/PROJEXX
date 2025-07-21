// ============================================
// backend/middleware/verifyToken.js - BULLETPROOF
// ============================================
const jwt = require("jsonwebtoken");

console.log("🔧 [VERIFY_TOKEN] Loading bulletproof verifyToken middleware...");

// Safe config import
let jwtSecret;
try {
  const { jwtSecret: secret } = require("../config/jwt");
  jwtSecret = secret;
  console.log("✅ [VERIFY_TOKEN] JWT config loaded from file");
} catch (err) {
  jwtSecret = process.env.JWT_SECRET || "fallback_secret_change_in_production";
  console.log("⚠️  [VERIFY_TOKEN] Using environment JWT secret");
}

const verifyToken = (req, res, next) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Log request for debugging (in development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${timestamp}] [VERIFY_TOKEN] ${req.method} ${req.originalUrl}`);
      console.log(`🔍 [VERIFY_TOKEN] Cookies:`, req.cookies);
      console.log(`🔍 [VERIFY_TOKEN] Headers:`, {
        authorization: req.headers.authorization ? 'Present' : 'None',
        origin: req.headers.origin,
        userAgent: req.headers['user-agent']?.substring(0, 50) + '...'
      });
    }

    // Try to get token from multiple sources
    let token = null;
    
    // 1. Try HTTP-only cookie (preferred method)
    if (req.cookies?.token) {
      token = req.cookies.token;
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ [VERIFY_TOKEN] Token found in cookie`);
      }
    }
    
    // 2. Try Authorization header as fallback
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ [VERIFY_TOKEN] Token found in Authorization header`);
        }
      }
    }
    
    // 3. Try query parameter as last resort (less secure)
    if (!token && req.query.token) {
      token = req.query.token;
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️  [VERIFY_TOKEN] Token found in query parameter (less secure)`);
      }
    }

    // No token found
    if (!token) {
      console.log(`❌ [VERIFY_TOKEN] No token provided for ${req.originalUrl}`);
      return res.status(401).json({ 
        success: false,
        message: "Access denied. No authentication token provided.",
        code: "NO_TOKEN"
      });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'projectflow-backend',
      audience: 'projectflow-frontend'
    });

    // Validate token payload
    if (!decoded.id || !decoded.role) {
      console.log(`❌ [VERIFY_TOKEN] Invalid token payload structure`);
      return res.status(401).json({ 
        success: false,
        message: "Invalid token format.",
        code: "INVALID_TOKEN_FORMAT"
      });
    }

    // Check token expiration (additional check)
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      console.log(`❌ [VERIFY_TOKEN] Token expired for user ${decoded.id}`);
      return res.status(401).json({ 
        success: false,
        message: "Token has expired. Please log in again.",
        code: "TOKEN_EXPIRED"
      });
    }

    // Add user info to request object
    req.user = {
      id: decoded.id,
      role: decoded.role,
      username: decoded.username,
      email: decoded.email,
      permissions: decoded.permissions || {}
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [VERIFY_TOKEN] Token verified for user: ${decoded.username} (${decoded.role})`);
    }

    // Continue to next middleware
    next();

  } catch (err) {
    console.error(`❌ [VERIFY_TOKEN] Token verification failed:`, err.message);
    
    // Handle specific JWT errors
    let errorMessage = "Invalid token.";
    let errorCode = "INVALID_TOKEN";
    
    if (err.name === 'TokenExpiredError') {
      errorMessage = "Token has expired. Please log in again.";
      errorCode = "TOKEN_EXPIRED";
    } else if (err.name === 'JsonWebTokenError') {
      errorMessage = "Invalid token format.";
      errorCode = "INVALID_TOKEN_FORMAT";
    } else if (err.name === 'NotBeforeError') {
      errorMessage = "Token not active yet.";
      errorCode = "TOKEN_NOT_ACTIVE";
    }

    return res.status(401).json({ 
      success: false,
      message: errorMessage,
      code: errorCode,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

console.log("✅ [VERIFY_TOKEN] Bulletproof verifyToken middleware loaded");

module.exports = verifyToken;