const express = require("express");
const router = express.Router();
const ProjectServer = require("../models/projectServerSchema");
const Faculty = require("../models/facultySchema");
const { v4: uuidv4 } = require("uuid");
const verifyToken = require("../middleware/verifyToken");

// Utility to generate project code
function generateProjectCode() {
  return "PRJ-" + uuidv4().split("-")[0].toUpperCase(); // e.g., PRJ-AB1234
}
// ✅ Create Project Server
router.post("/createProjectServer", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ message: "Only faculty can create project servers" });
    }
 
    const { title, description } = req.body;

    const newProjectServer = new ProjectServer({
      title,
      description,
      faculty: req.user.id,
      code: generateProjectCode()
    });

    await newProjectServer.save();

    res.status(201).json({
      message: "Project Server created successfully",
      projectServer: newProjectServer
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create project server", error: err.message });
  }
});

// ✅ Get all project servers for a faculty
router.get("/faculty/:facultyId", verifyToken, async (req, res) => {
  try {
    const servers = await ProjectServer.find({ faculty: req.params.facultyId });
    res.status(200).json(servers);
  } catch (err) {
    res.status(500).json({ message: "Error fetching project servers", error: err.message });
  }
});

// ✅ Get server by join code (for joining)
router.get("/byCode/:code", async (req, res) => {
  try {
    const server = await ProjectServer.findOne({ code: req.params.code }).populate("faculty");
    if (!server) return res.status(404).json({ message: "Invalid project server code" });

    res.status(200).json(server);
  } catch (err) {
    res.status(500).json({ message: "Failed to find project server", error: err.message });
  }
});

module.exports = router;
