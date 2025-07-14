
// backend/config/jwt.js
module.exports = {
  jwtSecret: process.env.JWT_SECRET || "your_super_secret_jwt_key_here_change_in_production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h"
};