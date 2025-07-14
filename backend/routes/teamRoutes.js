const express = require("express");
const router = express.Router();

const StudentTeam = require("../models/studentTeamSchema");
const Student = require("../models/studentSchema");
const ProjectServer = require("../models/projectServerSchema");
const verifyToken = require("../middleware/verifyToken");

// Create a new team (authenticated student)
router.post("/createTeam", verifyToken, async (req, res) => {
  try {
    const { name, projectServerCode, studentIds } = req.body;
    // console.log()
    // Validate input
    if (!name || !projectServerCode || !Array.isArray(studentIds)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if project server exists
   // 🔁 Find by projectServer.code (not by _id)
    const projectServer = await ProjectServer.findOne({ code: projectServerCode });
   
    if (!projectServer) {
      return res.status(404).json({ message: "Project server not found" });
    }

    // Create the team
    const newTeam = new StudentTeam({
      name,
      projectServer: projectServer.code,
      members: studentIds
    });

    const savedTeam = await newTeam.save();
 
    // Update each student's joinedTeams
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $push: { joinedTeams: savedTeam._id } }
    );

    res.status(201).json({ message: "Team created successfully", team: savedTeam });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating team", error: err.message });
  }
});

// Get teams under a project server
router.get("/by-project/:projectServerId", verifyToken, async (req, res) => {
  try {
    const { projectServerId } = req.params;

    const teams = await StudentTeam.find({ projectServer: projectServerId }).populate("members");

    res.status(200).json(teams);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch teams", error: err.message });
  }
});

// Get teams a student has joined
router.get("/by-student/:studentId", verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId).populate("joinedTeams");
    if (!student) return res.status(404).json({ message: "Student not found" });

    res.status(200).json(student.joinedTeams);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch joined teams", error: err.message });
  }
});

module.exports = router;
