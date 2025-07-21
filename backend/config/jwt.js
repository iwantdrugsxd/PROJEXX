const crypto = require('crypto');

console.log("🔧 [JWT_CONFIG] Loading JWT configuration...");

// Generate a secure random secret if none provided
const generateSecureSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Validate JWT secret strength
const validateSecret = (secret) => {
  if (!secret) return false;
  if (secret.length < 32) return false;
  if (secret === 'your_super_secret_jwt_key_here_change_in_production') return false;
  return true;
};

// Get JWT secret with validation
let jwtSecret = process.env.JWT_SECRET;

if (!validateSecret(jwtSecret)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 [JWT_CONFIG] CRITICAL: Invalid or missing JWT_SECRET in production!');
    console.error('🚨 [JWT_CONFIG] Please set a secure JWT_SECRET environment variable.');
    process.exit(1);
  } else {
    console.warn('⚠️  [JWT_CONFIG] Weak or missing JWT_SECRET, generating temporary secret for development');
    jwtSecret = generateSecureSecret();
    console.warn('⚠️  [JWT_CONFIG] Generated secret (use in production): ' + jwtSecret.substring(0, 16) + '...');
  }
}

// JWT configuration
const jwtConfig = {
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  jwtIssuer: process.env.JWT_ISSUER || 'projectflow-backend',
  jwtAudience: process.env.JWT_AUDIENCE || 'projectflow-frontend',
  
  // Additional security options
  options: {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    issuer: process.env.JWT_ISSUER || 'projectflow-backend',
    audience: process.env.JWT_AUDIENCE || 'projectflow-frontend',
    notBefore: '0s', // Token is valid immediately
  },
  
  // Cookie configuration
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
    path: '/'
  }
};

// Validate configuration
if (process.env.NODE_ENV === 'production') {
  console.log('✅ [JWT_CONFIG] Production JWT configuration validated');
} else {
  console.log('✅ [JWT_CONFIG] Development JWT configuration loaded');
}

console.log('📋 [JWT_CONFIG] Configuration summary:');
console.log(`   - Secret length: ${jwtSecret.length} characters`);
console.log(`   - Expires in: ${jwtConfig.jwtExpiresIn}`);
console.log(`   - Issuer: ${jwtConfig.jwtIssuer}`);
console.log(`   - Audience: ${jwtConfig.jwtAudience}`);
console.log(`   - Secure cookies: ${jwtConfig.cookieOptions.secure}`);

module.exports = jwtConfig;
