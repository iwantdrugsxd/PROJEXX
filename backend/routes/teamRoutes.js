const express = require("express");
const router = express.Router();
const StudentTeam = require("../models/studentTeamSchema");
const Student = require("../models/studentSchema");
const ProjectServer = require("../models/projectServerSchema");
const verifyToken = require("../middleware/verifyToken");

// ✅ Create a new team (authenticated student)
router.post("/createTeam", verifyToken, async (req, res) => {
  try {
    const { name, projectServerCode, memberEmails } = req.body;
    
    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ 
        message: "Team name is required",
        success: false 
      });
    }

    if (!projectServerCode || projectServerCode.trim().length === 0) {
      return res.status(400).json({ 
        message: "Project server code is required",
        success: false 
      });
    }

    if (!Array.isArray(memberEmails) || memberEmails.length === 0) {
      return res.status(400).json({ 
        message: "At least one team member email is required",
        success: false 
      });
    }

    // Check if project server exists
    const projectServer = await ProjectServer.findOne({ code: projectServerCode.trim() });
    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found with the provided code",
        success: false 
      });
    }

    // Find students by email
    const students = await Student.find({ 
      email: { $in: memberEmails.map(email => email.trim().toLowerCase()) } 
    });

    if (students.length !== memberEmails.length) {
      const foundEmails = students.map(s => s.email);
      const notFoundEmails = memberEmails.filter(email => 
        !foundEmails.includes(email.trim().toLowerCase())
      );
      return res.status(400).json({ 
        message: `Some students not found with emails: ${notFoundEmails.join(", ")}`,
        success: false 
      });
    }

    const studentIds = students.map(s => s._id);

    // Check if team creator is included in the team
    if (!studentIds.some(id => id.toString() === req.user.id)) {
      studentIds.push(req.user.id);
    }

    // Check if a team with the same name already exists in this project server
    const existingTeam = await StudentTeam.findOne({ 
      name: name.trim(), 
      projectServer: projectServer.code 
    });

    if (existingTeam) {
      return res.status(400).json({ 
        message: "A team with this name already exists in this project server",
        success: false 
      });
    }

    // 📦 Create the team
    const newTeam = new StudentTeam({
      name: name.trim(),
      projectServer: projectServer.code,
      members: studentIds,
      creator: req.user.id
    });

    const savedTeam = await newTeam.save();

    // 🔄 Update students' joinedTeams
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $addToSet: { joinedTeams: savedTeam._id } }
    );

    // Populate the saved team for response
    const populatedTeam = await StudentTeam.findById(savedTeam._id)
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    res.status(201).json({ 
      message: "Team created successfully", 
      success: true,
      team: populatedTeam 
    });
  } catch (err) {
    console.error("Error creating team:", err);
    res.status(500).json({ 
      message: "Error creating team", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Get teams under a project server
router.get("/by-project/:projectServerCode", verifyToken, async (req, res) => {
  try {
    const { projectServerCode } = req.params;

    // Verify project server exists
    const projectServer = await ProjectServer.findOne({ code: projectServerCode });
    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Check access permissions
    if (req.user.role === "faculty" && projectServer.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    const teams = await StudentTeam.find({ projectServer: projectServerCode })
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      teams
    });
  } catch (err) {
    console.error("Error fetching teams:", err);
    res.status(500).json({ 
      message: "Failed to fetch teams", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Get teams a student has joined
router.get("/by-student/:studentId", verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check access permissions
    if (req.user.role === "student" && req.user.id !== studentId) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    const student = await Student.findById(studentId)
      .populate({
        path: "joinedTeams",
        populate: [
          {
            path: "members",
            select: "firstName lastName email"
          },
          {
            path: "creator",
            select: "firstName lastName email"
          }
        ]
      });
    
    if (!student) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    res.status(200).json({
      success: true,
      teams: student.joinedTeams || []
    });
  } catch (err) {
    console.error("Error fetching student teams:", err);
    res.status(500).json({ 
      message: "Failed to fetch joined teams", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Join existing team with invite code
router.post("/join", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can join teams",
        success: false 
      });
    }

    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ 
        message: "Team ID is required",
        success: false 
      });
    }

    const team = await StudentTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ 
        message: "Team not found",
        success: false 
      });
    }

    // Check if student is already a member
    if (team.members.includes(req.user.id)) {
      return res.status(400).json({ 
        message: "You are already a member of this team",
        success: false 
      });
    }

    // Add student to team
    team.members.push(req.user.id);
    await team.save();

    // Add team to student's joinedTeams
    await Student.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { joinedTeams: teamId } }
    );

    const updatedTeam = await StudentTeam.findById(teamId)
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    res.status(200).json({
      message: "Successfully joined team",
      success: true,
      team: updatedTeam
    });
  } catch (err) {
    console.error("Error joining team:", err);
    res.status(500).json({ 
      message: "Failed to join team", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Get team details
router.get("/:teamId", verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await StudentTeam.findById(teamId)
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    if (!team) {
      return res.status(404).json({ 
        message: "Team not found",
        success: false 
      });
    }

    // Check access permissions
    const isTeamMember = team.members.some(member => member._id.toString() === req.user.id);
    if (req.user.role === "student" && !isTeamMember) {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    res.status(200).json({
      success: true,
      team
    });
  } catch (err) {
    console.error("Error fetching team details:", err);
    res.status(500).json({ 
      message: "Failed to fetch team details", 
      error: err.message,
      success: false 
    });
  }
});

// ✅ Get teams for faculty (all teams in their project servers)
router.get("/faculty-teams", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Access denied",
        success: false 
      });
    }

    // Get all project servers for this faculty
    const ProjectServer = require("../models/projectServerSchema");
    const facultyServers = await ProjectServer.find({ faculty: req.user.id });
    const serverCodes = facultyServers.map(server => server.code);

    if (serverCodes.length === 0) {
      return res.status(200).json({
        success: true,
        teams: [],
        servers: [],
        message: "No project servers found. Create a project server first."
      });
    }

    // Get all teams in those servers
    const teams = await StudentTeam.find({ 
      projectServer: { $in: serverCodes } 
    })
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email")
      .sort({ createdAt: -1 });

    console.log(`Faculty ${req.user.id} has ${facultyServers.length} servers and ${teams.length} teams`);

    res.status(200).json({
      success: true,
      teams,
      servers: facultyServers,
      serverCodes,
      message: teams.length === 0 ? "No teams found. Students need to create teams in your project servers." : `Found ${teams.length} teams`
    });
  } catch (err) {
    console.error("Error fetching faculty teams:", err);
    res.status(500).json({ 
      message: "Failed to fetch teams", 
      error: err.message,
      success: false 
    });
  }
});

module.exports = router;