const express = require("express");
const router = express.Router();
const StudentTeam = require("../models/studentTeamSchema");
const Student = require("../models/studentSchema");
const ProjectServer = require("../models/projectServerSchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 teamRoutes.js loaded");

// ✅ Enhanced team creation with better validation
router.post("/createTeam", verifyToken, async (req, res) => {
  try {
    const { name, projectServerCode, memberEmails } = req.body;
    
    // Enhanced input validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ 
        message: "Team name is required",
        success: false 
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ 
        message: "Team name must be at least 2 characters long",
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

    // ✅ Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = memberEmails.filter(email => email.trim().length > 0);
    const invalidEmails = validEmails.filter(email => !emailRegex.test(email.trim()));
    
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        message: `Invalid email format: ${invalidEmails.join(", ")}`,
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

    // ✅ NEW: Verify team creator is member of the project server
    const creatorStudent = await Student.findOne({
      _id: req.user.id,
      joinedServers: projectServer._id
    });
    
    if (!creatorStudent) {
      return res.status(403).json({ 
        message: "You must be a member of this project server to create teams",
        success: false 
      });
    }

    // Find students by email (normalize to lowercase)
    const normalizedEmails = validEmails.map(email => email.trim().toLowerCase());
    const students = await Student.find({ 
      email: { $in: normalizedEmails } 
    });

    if (students.length !== normalizedEmails.length) {
      const foundEmails = students.map(s => s.email);
      const notFoundEmails = normalizedEmails.filter(email => 
        !foundEmails.includes(email)
      );
      return res.status(400).json({ 
        message: `Some students not found with emails: ${notFoundEmails.join(", ")}`,
        success: false 
      });
    }

    // ✅ Verify all team members are part of the project server
    const studentsInServer = await Student.find({
      _id: { $in: students.map(s => s._id) },
      joinedServers: projectServer._id
    });

    if (studentsInServer.length !== students.length) {
      const studentsInServerIds = studentsInServer.map(s => s._id.toString());
      const studentsNotInServer = students.filter(s => 
        !studentsInServerIds.includes(s._id.toString())
      );
      const notInServerEmails = studentsNotInServer.map(s => s.email);
      
      return res.status(400).json({ 
        message: `Some team members are not part of this project server: ${notInServerEmails.join(", ")}`,
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

    console.log(`✅ Team "${name.trim()}" created successfully by ${req.user.id}`);

    res.status(201).json({ 
      message: "Team created successfully", 
      success: true,
      team: populatedTeam 
    });
  } catch (err) {
    console.error("Error creating team:", err);
    res.status(500).json({ 
      message: "Error creating team", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get teams under a project server
router.get("/by-project/:projectServerCode", verifyToken, async (req, res) => {
  try {
    const { projectServerCode } = req.params;

    if (!projectServerCode || projectServerCode.trim().length === 0) {
      return res.status(400).json({ 
        message: "Project server code is required",
        success: false 
      });
    }

    // Verify project server exists
    const projectServer = await ProjectServer.findOne({ code: projectServerCode.trim() });
    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Get all teams in this project server
    const teams = await StudentTeam.find({ projectServer: projectServerCode.trim() })
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      teams,
      projectServer: {
        code: projectServer.code,
        title: projectServer.title,
        description: projectServer.description
      },
      message: teams.length === 0 ? "No teams found in this project server" : `Found ${teams.length} teams`
    });
  } catch (err) {
    console.error("Error fetching teams by project:", err);
    res.status(500).json({ 
      message: "Failed to fetch teams", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get teams for a student
router.get("/student-teams", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Access denied. Student access required.",
        success: false 
      });
    }

    // Get teams where student is a member
    const teams = await StudentTeam.find({ 
      members: req.user.id 
    })
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email")
      .sort({ createdAt: -1 });

    console.log(`Student ${req.user.id} has ${teams.length} teams`);

    res.status(200).json({
      success: true,
      teams,
      message: teams.length === 0 ? "No teams found. Join or create a team to get started." : `Found ${teams.length} teams`
    });
  } catch (err) {
    console.error("Error fetching student teams:", err);
    res.status(500).json({ 
      message: "Failed to fetch teams", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Join an existing team
router.post("/join/:teamId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can join teams",
        success: false 
      });
    }

    const { teamId } = req.params;

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

    // Verify student is part of the project server
    const projectServer = await ProjectServer.findOne({ code: team.projectServer });
    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    } 

    const student = await Student.findOne({
      _id: req.user.id,
      joinedServers: projectServer._id
    });

    if (!student) {
      return res.status(403).json({ 
        message: "You must be a member of the project server to join this team",
        success: false 
      });
    }
router.get('/server/:serverId/teams', verifyToken, async (req, res) => {
  const { serverId } = req.params;
  const teams = await Team.find({ server: serverId }).select('name _id');
  res.json({ success: true, teams });
});
    // Add student to team
    team.members.push(req.user.id);
    await team.save();

    // Add team to student's joinedTeams
    await Student.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { joinedTeams: teamId } }
    );

    // Return updated team
    const updatedTeam = await StudentTeam.findById(teamId)
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    res.status(200).json({
      message: "Successfully joined the team",
      success: true,
      team: updatedTeam
    });
  } catch (err) {
    console.error("Error joining team:", err);
    res.status(500).json({ 
      message: "Failed to join team", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Leave a team
router.post("/leave/:teamId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can leave teams",
        success: false 
      });
    }

    const { teamId } = req.params;

    const team = await StudentTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ 
        message: "Team not found",
        success: false 
      });
    }

    // Check if student is a member
    if (!team.members.includes(req.user.id)) {
      return res.status(400).json({ 
        message: "You are not a member of this team",
        success: false 
      });
    }

    // Check if student is the creator - they cannot leave unless they transfer ownership
    if (team.creator && team.creator.toString() === req.user.id) {
      if (team.members.length > 1) {
        return res.status(400).json({ 
          message: "As team creator, you must transfer ownership or delete the team before leaving",
          success: false 
        });
      }
    }

    // Remove student from team
    team.members = team.members.filter(memberId => memberId.toString() !== req.user.id);
    
    // If team becomes empty, delete it
    if (team.members.length === 0) {
      await StudentTeam.findByIdAndDelete(teamId);
      
      // Remove team from all students' joinedTeams
      await Student.updateMany(
        { joinedTeams: teamId },
        { $pull: { joinedTeams: teamId } }
      );

      return res.status(200).json({
        message: "Team deleted as it had no remaining members",
        success: true,
        teamDeleted: true
      });
    }

    await team.save();

    // Remove team from student's joinedTeams
    await Student.findByIdAndUpdate(
      req.user.id,
      { $pull: { joinedTeams: teamId } }
    );

    res.status(200).json({
      message: "Successfully left the team",
      success: true
    });
  } catch (err) {
    console.error("Error leaving team:", err);
    res.status(500).json({ 
      message: "Failed to leave team", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
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
    const isFacultyWithAccess = req.user.role === "faculty"; // Faculty can view all teams in their servers
    
    if (req.user.role === "student" && !isTeamMember) {
      return res.status(403).json({ 
        message: "Access denied. You must be a team member to view team details.",
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
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get teams for faculty (all teams in their project servers)
router.get("/faculty-teams", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Access denied. Faculty access required.",
        success: false 
      });
    }

    // Get all project servers for this faculty
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
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Update team details (creator only)
router.put("/:teamId", verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, description } = req.body;

    const team = await StudentTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ 
        message: "Team not found",
        success: false 
      });
    }

    // Check if user is the team creator
    if (team.creator.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "Only team creator can update team details",
        success: false 
      });
    }

    // Validate input
    if (name && name.trim().length < 2) {
      return res.status(400).json({ 
        message: "Team name must be at least 2 characters long",
        success: false 
      });
    }

    // Check if new name already exists in the same project server
    if (name && name.trim() !== team.name) {
      const existingTeam = await StudentTeam.findOne({ 
        name: name.trim(), 
        projectServer: team.projectServer,
        _id: { $ne: teamId }
      });

      if (existingTeam) {
        return res.status(400).json({ 
          message: "A team with this name already exists in this project server",
          success: false 
        });
      }
    }

    // Update team
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();

    const updatedTeam = await StudentTeam.findByIdAndUpdate(
      teamId,
      updateData,
      { new: true }
    )
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    res.status(200).json({
      message: "Team updated successfully",
      success: true,
      team: updatedTeam
    });
  } catch (err) {
    console.error("Error updating team:", err);
    res.status(500).json({ 
      message: "Failed to update team", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Delete team (creator only)
router.delete("/:teamId", verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await StudentTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ 
        message: "Team not found",
        success: false 
      });
    }

    // Check if user is the team creator
    if (team.creator.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "Only team creator can delete the team",
        success: false 
      });
    }

    // Remove team from all members' joinedTeams
    await Student.updateMany(
      { joinedTeams: teamId },
      { $pull: { joinedTeams: teamId } }
    );

    // Delete the team
    await StudentTeam.findByIdAndDelete(teamId);

    res.status(200).json({
      message: "Team deleted successfully",
      success: true
    });
  } catch (err) {
    console.error("Error deleting team:", err);
    res.status(500).json({ 
      message: "Failed to delete team", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

console.log("🔧 All team routes defined successfully");

module.exports = router;