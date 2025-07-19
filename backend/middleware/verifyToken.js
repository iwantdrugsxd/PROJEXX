const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/jwt");

const verifyToken = (req, res, next) => {
 console.log("🔍 DEBUG: req.cookies =", req.cookies);
const token = req.cookies?.token;

  if (!token) return res.status(401).json({ message: "Access Denied: No token provided" });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};

module.exports = verifyToken;
