const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 5000;

// importing routes
const FacultyRoutes = require("./routes/facultyRoutes.js");
const StudentRoutes = require("./routes/studentRoutes.js");
const projectServerRoutes = require("./routes/projectServerRoutes");
const teamRoutes = require("./routes/teamRoutes.js");
const taskRoutes = require("./routes/taskRoutes.js");

// MongoDB connection URI
const MONGO_URI = "mongodb+srv://yashr:NPuILa9Awq8H0DED@cluster0.optidea.mongodb.net/project_management?retryWrites=true&w=majority&appName=Cluster0";

// Manual CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({ message: "✅ Backend Server Connected" });
});

// Routes - Make sure these are correct
app.use("/api/faculty", FacultyRoutes);
app.use("/api/student", StudentRoutes);
app.use("/api/projectServers", projectServerRoutes); // This should mount your project server routes
app.use("/api/teamRoutes", teamRoutes);
app.use("/api/task", taskRoutes);

// Catch-all route for debugging
app.use('*', (req, res) => {
  console.log('Route not found:', req.method, req.originalUrl);
  res.status(404).json({ 
    message: 'Route not found', 
    method: req.method, 
    path: req.originalUrl,
    availableRoutes: [
      'GET /',
      'POST /api/faculty/*',
      'POST /api/student/*',
      'POST /api/projectServers/*',
      'POST /api/teamRoutes/*',
      'POST /api/task/*'
    ]
  });
});

// Connect to MongoDB and start server
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
      console.log(`🔗 CORS manually configured for localhost:3000`);
      console.log(`📋 Available routes:`);
      console.log(`   POST /api/projectServers/join`);
      console.log(`   GET  /api/projectServers/student-servers`);
      console.log(`   POST /api/projectServers/createProjectServer`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
  });