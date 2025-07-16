const express = require("express");
const router = express.Router();
const StudentTeam = require("../models/studentTeamSchema");
const Student = require("../models/studentSchema");
const ProjectServer = require("../models/projectServerSchema");
const verifyToken = require("../middleware/verifyToken");
const NotificationService = require('../services/notificationService');

console.log("🔧 teamRoutes.js loaded");

// ✅ Enhanced team creation - NO server membership required
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

    // Enhanced email validation
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
    const projectServer = await ProjectServer.findOne({ code: projectServerCode.trim().toUpperCase() });
    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found with the provided code",
        success: false 
      });
    }

    // ✅ REMOVED: Server membership requirement for team creator
    // Just verify the creator exists
    const creatorStudent = await Student.findById(req.user.id);
    if (!creatorStudent) {
      return res.status(404).json({ 
        message: "Student not found",
        success: false 
      });
    }

    // Find students by email (normalize to lowercase)
    const normalizedEmails = validEmails.map(email => email.trim().toLowerCase());
    const students = await Student.find({ 
      email: { $in: normalizedEmails } 
    });

    if (students.length !== normalizedEmails.length) {
      const foundEmails = students.map(s => s.email.toLowerCase());
      const notFoundEmails = normalizedEmails.filter(email => !foundEmails.includes(email));
      return res.status(404).json({ 
        message: `Student accounts not found for: ${notFoundEmails.join(", ")}`,
        success: false 
      });
    }

    const studentIds = students.map(s => s._id);

    // Check for duplicate team names in the same project server
    const existingTeam = await StudentTeam.findOne({ 
      name: name.trim(), 
      projectServer: projectServerCode.trim().toUpperCase() 
    });
    
    if (existingTeam) {
      return res.status(400).json({ 
        message: "A team with this name already exists in this project server",
        success: false 
      });
    }

    // Check if any student is already in another team for this project
    const existingTeamMemberships = await StudentTeam.find({
      projectServer: projectServerCode.trim().toUpperCase(),
      members: { $in: studentIds }
    }).populate('members', 'firstName lastName email');

    if (existingTeamMemberships.length > 0) {
      const conflictingMembers = [];
      existingTeamMemberships.forEach(team => {
        team.members.forEach(member => {
          if (studentIds.some(id => id.toString() === member._id.toString())) {
            conflictingMembers.push({
              email: member.email,
              teamName: team.name
            });
          }
        });
      });

      if (conflictingMembers.length > 0) {
        return res.status(400).json({ 
          message: "Some members are already in other teams in this project",
          conflicts: conflictingMembers,
          success: false 
        });
      }
    }

    // Create the team
    const newTeam = new StudentTeam({
      name: name.trim(),
      projectServer: projectServerCode.trim().toUpperCase(),
      members: studentIds,
      creator: req.user.id,
      createdAt: new Date()
    });

    await newTeam.save();

    // Add team to each student's joinedTeams array
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $addToSet: { joinedTeams: newTeam._id } }
    );

    // Populate the team with member details for response
    const populatedTeam = await StudentTeam.findById(newTeam._id)
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    // Send notifications
    if (NotificationService && NotificationService.notifyTeamCreated) {
      await NotificationService.notifyTeamCreated(projectServer, newTeam, studentIds);
    }

    console.log(`✅ Team "${name.trim()}" created in project ${projectServerCode.trim()}`);

    res.status(201).json({
      message: "Team created successfully!",
      success: true,
      team: populatedTeam
    });

  } catch (err) {
    console.error("Error creating team:", err);
    res.status(500).json({ 
      message: "Failed to create team", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get teams under a project server - NO server membership required
router.get("/server/:serverId/teams", verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;

    // Get the project server
    const projectServer = await ProjectServer.findById(serverId);
    if (!projectServer) {
      return res.status(404).json({ 
        message: "Project server not found",
        success: false 
      });
    }

    // Check if faculty owns the server
    if (req.user.role === 'faculty' && projectServer.faculty.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only access teams from your own servers",
        success: false 
      });
    }

    // ✅ REMOVED: Server membership check for students
    // Students can now view teams without being server members

    // Get all teams in this project server
    const teams = await StudentTeam.find({ projectServer: projectServer.code })
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      teams,
      server: {
        id: projectServer._id,
        code: projectServer.code,
        title: projectServer.title,
        description: projectServer.description
      },
      message: teams.length === 0 ? "No teams found in this project server" : `Found ${teams.length} teams`
    });
  } catch (err) {
    console.error("Error fetching teams by server:", err);
    res.status(500).json({ 
      message: "Failed to fetch teams", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Get student's teams - based on team membership only
router.get("/student-teams", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can access this endpoint",
        success: false 
      });
    }

    // Find teams where the student is a member
    const teams = await StudentTeam.find({ members: req.user.id })
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      teams,
      message: teams.length === 0 ? "No teams found. Create or join a team to get started." : `Found ${teams.length} teams`
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

// ✅ Get faculty teams - teams in servers owned by faculty
router.get("/faculty-teams", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can access this endpoint",
        success: false 
      });
    }

    // Find all servers owned by this faculty
    const facultyServers = await ProjectServer.find({ faculty: req.user.id }).select('code title');
    const serverCodes = facultyServers.map(server => server.code);

    if (serverCodes.length === 0) {
      return res.status(200).json({
        success: true,
        teams: [],
        message: "No teams found. Create a project server first."
      });
    }

    // Find teams in faculty's servers
    const teams = await StudentTeam.find({ projectServer: { $in: serverCodes } })
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email")
      .sort({ createdAt: -1 });

    // Add server info to each team
    const teamsWithServerInfo = teams.map(team => {
      const teamObj = team.toObject();
      const server = facultyServers.find(s => s.code === team.projectServer);
      teamObj.serverInfo = server ? { title: server.title, code: server.code } : null;
      return teamObj;
    });

    res.status(200).json({
      success: true,
      teams: teamsWithServerInfo,
      serversCount: facultyServers.length,
      message: teams.length === 0 ? "No teams found in your servers." : `Found ${teams.length} teams across ${facultyServers.length} servers`
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

    // Check if student is already in another team for this project
    const existingTeam = await StudentTeam.findOne({
      projectServer: team.projectServer,
      members: req.user.id
    });

    if (existingTeam) {
      return res.status(400).json({ 
        message: `You are already in team "${existingTeam.name}" for this project`,
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

    const populatedTeam = await StudentTeam.findById(teamId)
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    console.log(`✅ Student ${req.user.id} joined team ${team.name}`);

    res.status(200).json({
      message: "Successfully joined the team",
      success: true,
      team: populatedTeam
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

    // Remove student from team
    team.members = team.members.filter(member => member.toString() !== req.user.id);
    
    // If team becomes empty, delete it
    if (team.members.length === 0) {
      await StudentTeam.findByIdAndDelete(teamId);
      console.log(`✅ Team ${team.name} deleted as it became empty`);
    } else {
      await team.save();
    }

    // Remove team from student's joinedTeams
    await Student.findByIdAndUpdate(
      req.user.id,
      { $pull: { joinedTeams: teamId } }
    );

    console.log(`✅ Student ${req.user.id} left team ${team.name}`);

    res.status(200).json({
      message: team.members.length === 0 ? "Left team successfully. Team was deleted as it became empty." : "Left team successfully",
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

// ✅ Delete a team (only creator or faculty can delete)
router.delete("/:teamId", verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await StudentTeam.findById(teamId).populate('members', '_id');

    if (!team) {
      return res.status(404).json({ 
        message: "Team not found",
        success: false 
      });
    }

    // Check permissions
    const canDelete = req.user.role === 'faculty' || team.creator.toString() === req.user.id;
    
    if (!canDelete) {
      return res.status(403).json({ 
        message: "You can only delete teams you created",
        success: false 
      });
    }

    // Remove team from all members' joinedTeams
    const memberIds = team.members.map(member => member._id);
    await Student.updateMany(
      { _id: { $in: memberIds } },
      { $pull: { joinedTeams: teamId } }
    );

    await StudentTeam.findByIdAndDelete(teamId);

    console.log(`✅ Team ${team.name} deleted by ${req.user.role} ${req.user.id}`);

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

// ✅ Search teams by name or project server
router.get("/search/:query", verifyToken, async (req, res) => {
  try {
    const { query } = req.params;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        message: "Search query must be at least 2 characters long",
        success: false 
      });
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    
    let teams;
    if (req.user.role === 'faculty') {
      // Faculty can search all teams in their servers
      const facultyServers = await ProjectServer.find({ faculty: req.user.id }).select('code');
      const serverCodes = facultyServers.map(server => server.code);
      
      teams = await StudentTeam.find({
        $and: [
          { projectServer: { $in: serverCodes } },
          {
            $or: [
              { name: searchRegex },
              { projectServer: searchRegex }
            ]
          }
        ]
      })
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email")
      .sort({ createdAt: -1 });
    } else {
      // Students can search teams they're part of
      teams = await StudentTeam.find({
        $and: [
          { members: req.user.id },
          {
            $or: [
              { name: searchRegex },
              { projectServer: searchRegex }
            ]
          }
        ]
      })
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email")
      .sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      teams,
      query: query.trim(),
      message: teams.length === 0 ? `No teams found matching "${query.trim()}"` : `Found ${teams.length} teams matching "${query.trim()}"`
    });
  } catch (err) {
    console.error("Error searching teams:", err);
    res.status(500).json({ 
      message: "Failed to search teams", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

module.exports = router;