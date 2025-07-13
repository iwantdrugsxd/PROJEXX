const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // ✅ You forgot this!
const cookieParser = require("cookie-parser");

// importing routes
const FacultyRoutes = require("./routes/facultyRoutes.js");
const StudentRoutes = require("./routes/studentRoutes.js");
const projectServerRoutes = require("./routes/projectServerRoutes");
const teamRoutes=require("./routes/teamRoutes.js")
    
const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB connection URI
const MONGO_URI = "mongodb+srv://yashr:NPuILa9Awq8H0DED@cluster0.optidea.mongodb.net/project_management?retryWrites=true&w=majority&appName=Cluster0";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Middleware
app.use(cookieParser());
// CORS Setup
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({ message: "✅ Backend Server Connected" });
});

//  Routes
app.use("/api/faculty", FacultyRoutes);
app.use("/api/student", StudentRoutes);
app.use("/api/projectServers", projectServerRoutes);
app.use("/api/teamRoutes",teamRoutes)
// Connect to MongoDB and start server
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
  });
 