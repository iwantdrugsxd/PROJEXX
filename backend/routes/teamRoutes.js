const express = require("express");
const router = express.Router();
const StudentTeam = require("../models/studentTeamSchema");
const Student = require("../models/studentSchema");
const ProjectServer = require("../models/projectServerSchema");
const verifyToken = require("../middleware/verifyToken");
const NotificationService = require('../services/notificationService');
console.log("🔧 teamRoutes.js loaded");

// ✅ Enhanced team creation with better validation
// ✅ Enhanced team creation - ALLOWS creation without server membership
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

    // ✅ REMOVED: Server membership requirement for team creator
    // Students can now create teams without being server members
    // The old validation is commented out below:
    /*
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
    */

    // ✅ Just verify the creator exists (no server membership required)
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

    // ✅ MODIFIED: No longer require all students to be server members
    // Allow team creation with any valid student accounts
    const studentIds = students.map(s => s._id);

    // ✅ Check for duplicate team names in the same project server
    const existingTeam = await StudentTeam.findOne({ 
      name: name.trim(), 
      projectServer: projectServerCode.trim() 
    });
    
    if (existingTeam) {
      return res.status(400).json({ 
        message: "A team with this name already exists in this project server",
        success: false 
      });
    }

    // ✅ Check if any student is already in another team for this project
    const existingTeamMemberships = await StudentTeam.find({
      projectServer: projectServerCode.trim(),
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
      projectServer: projectServerCode.trim(),
      members: studentIds,
      creator: req.user.id,
      createdAt: new Date()
    });
await NotificationService.notifyTeamJoinedServer(projectServer, newTeam, studentIds);
    await newTeam.save();

    // ✅ Add team to each student's joinedTeams array
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $addToSet: { joinedTeams: newTeam._id } }
    );

    // ✅ OPTIONAL: Auto-join team members to the project server
    // This ensures they have access to the server once they're in a team
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $addToSet: { joinedServers: projectServer._id } }
    );

    // ✅ Populate the team with member details for response
    const populatedTeam = await StudentTeam.findById(newTeam._id)
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    console.log(`✅ Team "${name.trim()}" created in project ${projectServerCode.trim()}`);
    console.log(`✅ Team members automatically joined server ${projectServer.code}`);

    res.status(201).json({
      message: "Team created successfully! All members have been added to the project server.",
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
// ✅ Get teams under a project server (Enhanced for task creation)
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

    // For students, verify they're part of the server
    if (req.user.role === 'student') {
      const student = await Student.findOne({
        _id: req.user.id,
        joinedServers: projectServer._id
      });
      
      if (!student) {
        return res.status(403).json({ 
          message: "You must be a member of this server to view its teams",
          success: false 
        });
      }
    }

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

// ✅ Get teams by project server code
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
router.post("/join", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can join project servers",
        success: false 
      });
    }

    const { code } = req.body;

    if (!code || code.trim().length === 0) {
      return res.status(400).json({ 
        message: "Server code is required",
        success: false 
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    const projectServer = await ProjectServer.findOne({ code: normalizedCode })
      .populate('faculty', 'firstName lastName email');

    if (!projectServer) {
      return res.status(404).json({ 
        message: "Invalid server code. Please check and try again.",
        success: false 
      });
    }

    // Check if already joined
    const student = await Student.findById(req.user.id);
    if (student.joinedServers.includes(projectServer._id)) {
      return res.status(400).json({ 
        message: "You have already joined this project server",
        success: false 
      });
    }

    // Add server to student's joinedServers
    student.joinedServers.push(projectServer._id);
    await student.save();

    // Check if student is part of a team in this server
    const team = await StudentTeam.findOne({
      projectServer: normalizedCode,
      members: req.user.id
    }).populate('members');

    if (team) {
      // Notify faculty about team joining
      await NotificationService.notifyTeamJoinedServer(
        projectServer,
        team,
        team.members
      );
    }

    console.log(`✅ Student ${req.user.id} joined server ${normalizedCode}`);

    res.json({
      message: "Successfully joined project server",
      success: true,
      server: {
        _id: projectServer._id,
        title: projectServer.title,
        description: projectServer.description,
        code: projectServer.code,
        faculty: projectServer.faculty
      }
    });

  } catch (err) {
    console.error("Error joining server:", err);
    res.status(500).json({ 
      message: "Failed to join server", 
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

    // If faculty, verify they have access to this team's project server
    if (req.user.role === "faculty") {
      const projectServer = await ProjectServer.findOne({ 
        code: team.projectServer,
        faculty: req.user.id 
      });
      
      if (!projectServer) {
        return res.status(403).json({ 
          message: "Access denied. You can only view teams from your own project servers.",
          success: false 
        });
      }
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

// ✅ Transfer team ownership
router.post("/transfer-ownership/:teamId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can transfer team ownership",
        success: false 
      });
    }

    const { teamId } = req.params;
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({ 
        message: "New owner ID is required",
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

    // Check if current user is the team creator
    if (team.creator.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "Only team creator can transfer ownership",
        success: false 
      });
    }

    // Check if new owner is a team member
    if (!team.members.includes(newOwnerId)) {
      return res.status(400).json({ 
        message: "New owner must be a team member",
        success: false 
      });
    }

    // Transfer ownership
    team.creator = newOwnerId;
    await team.save();

    // Return updated team
    const updatedTeam = await StudentTeam.findById(teamId)
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    res.status(200).json({
      message: "Team ownership transferred successfully",
      success: true,
      team: updatedTeam
    });
  } catch (err) {
    console.error("Error transferring team ownership:", err);
    res.status(500).json({ 
      message: "Failed to transfer ownership", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Remove member from team (Creator only)
router.post("/remove-member/:teamId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can remove team members",
        success: false 
      });
    }

    const { teamId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ 
        message: "Member ID is required",
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

    // Check if current user is the team creator
    if (team.creator.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "Only team creator can remove members",
        success: false 
      });
    }

    // Check if member exists in team
    if (!team.members.includes(memberId)) {
      return res.status(400).json({ 
        message: "User is not a team member",
        success: false 
      });
    }

    // Cannot remove self (use leave team instead)
    if (memberId === req.user.id) {
      return res.status(400).json({ 
        message: "Use leave team to remove yourself",
        success: false 
      });
    }

    // Remove member from team
    team.members = team.members.filter(member => member.toString() !== memberId);
    await team.save();

    // Remove team from member's joinedTeams
    await Student.findByIdAndUpdate(
      memberId,
      { $pull: { joinedTeams: teamId } }
    );

    // Return updated team
    const updatedTeam = await StudentTeam.findById(teamId)
      .populate("members", "firstName lastName email")
      .populate("creator", "firstName lastName email");

    res.status(200).json({
      message: "Member removed successfully",
      success: true,
      team: updatedTeam
    });
  } catch (err) {
    console.error("Error removing team member:", err);
    res.status(500).json({ 
      message: "Failed to remove member", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Delete team (Creator or Faculty only)
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

    // Check permissions - only creator or faculty can delete
    const isCreator = team.creator.toString() === req.user.id;
    const isFaculty = req.user.role === "faculty";
    
    if (!isCreator && !isFaculty) {
      return res.status(403).json({ 
        message: "Only team creator or faculty can delete teams",
        success: false 
      });
    }

    // If faculty, verify they own the project server
    if (isFaculty) {
      const projectServer = await ProjectServer.findOne({ 
        code: team.projectServer,
        faculty: req.user.id 
      });
      
      if (!projectServer) {
        return res.status(403).json({ 
          message: "You can only delete teams from your own project servers",
          success: false 
        });
      }
    }

    // Remove team from all members' joinedTeams
    await Student.updateMany(
      { _id: { $in: team.members } },
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

// ✅ Search teams by name (within user's accessible servers)
router.get("/search/:query", verifyToken, async (req, res) => {
  try {
    const { query } = req.params;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        message: "Search query must be at least 2 characters long",
        success: false 
      });
    }

    let teams = [];

    if (req.user.role === "student") {
      // For students, search within their joined servers
      const student = await Student.findById(req.user.id).populate('joinedServers', 'code');
      const serverCodes = student.joinedServers.map(server => server.code);
      
      teams = await StudentTeam.find({
        projectServer: { $in: serverCodes },
        name: { $regex: query.trim(), $options: 'i' }
      })
        .populate("members", "firstName lastName email")
        .populate("creator", "firstName lastName email")
        .limit(20);

    } else if (req.user.role === "faculty") {
      // For faculty, search within their project servers
      const facultyServers = await ProjectServer.find({ faculty: req.user.id });
      const serverCodes = facultyServers.map(server => server.code);
      
      teams = await StudentTeam.find({
        projectServer: { $in: serverCodes },
        name: { $regex: query.trim(), $options: 'i' }
      })
        .populate("members", "firstName lastName email")
        .populate("creator", "firstName lastName email")
        .limit(20);
    }

    res.status(200).json({
      success: true,
      teams,
      query: query.trim(),
      message: teams.length === 0 ? "No teams found matching your search" : `Found ${teams.length} teams`
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

console.log("🔧 All team routes defined successfully");

module.exports = router;