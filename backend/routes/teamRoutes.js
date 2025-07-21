// backend/routes/teamRoutes.js - NO AUTHENTICATION VERSION
const express = require('express');
const router = express.Router();
const StudentTeam = require('../models/studentTeamSchema');
const Student = require('../models/studentSchema');
const ProjectServer = require('../models/projectServerSchema');

// ✅ NO verifyToken middleware - direct access

// Utility function for consistent logging
const logWithTimestamp = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [TEAMS] [${level.toUpperCase()}] ${message}`, data);
};

// ✅ HEALTH CHECK ENDPOINT
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    route: 'teams',
    authentication: 'disabled'
  });
});

// ✅ CREATE TEAM - Modified to accept userId in body
router.post('/createTeam', async (req, res) => {
  try {
    const { name, description, projectServer, maxMembers, userId, userRole } = req.body;
    
    logWithTimestamp('info', 'Team creation attempt', {
      userId: userId,
      userRole: userRole,
      body: req.body
    });

    // Basic validation - accept any userRole or default to student
    const role = userRole || 'student';
    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can create teams'
      });
    }

    // Validate required fields
    if (!name || !projectServer || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Team name, project server code, and userId are required'
      });
    }

    // Verify project server exists
    const server = await ProjectServer.findOne({ code: projectServer.toUpperCase() });
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Invalid project server code'
      });
    }

    // Check if student is already in a team for this server
    const existingTeam = await StudentTeam.findOne({
      projectServer: projectServer.toUpperCase(),
      members: userId
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'User is already in a team for this project server',
        existingTeam: {
          name: existingTeam.name,
          id: existingTeam._id
        }
      });
    }

    // Check if team name already exists for this server
    const duplicateTeam = await StudentTeam.findOne({
      name: name.trim(),
      projectServer: projectServer.toUpperCase()
    });

    if (duplicateTeam) {
      return res.status(400).json({
        success: false,
        message: 'A team with this name already exists for this server'
      });
    }

    // Create the team
    const newTeam = new StudentTeam({
      name: name.trim(),
      description: description?.trim() || '',
      projectServer: projectServer.toUpperCase(),
      creator: userId,
      members: [userId],
      maxMembers: maxMembers || 4,
      status: 'active'
    });

    await newTeam.save();

    // Populate the team for response
    const populatedTeam = await StudentTeam.findById(newTeam._id)
      .populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email');

    logWithTimestamp('info', 'Team created successfully', {
      teamId: newTeam._id,
      teamName: newTeam.name,
      creatorId: userId,
      serverCode: projectServer.toUpperCase()
    });

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      team: populatedTeam
    });

  } catch (error) {
    logWithTimestamp('error', 'Team creation failed', {
      error: error.message,
      userId: req.body.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create team',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TEAMS BY SERVER ID
router.get('/server/:serverId/teams', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    logWithTimestamp('info', 'Fetching teams by server ID', {
      serverId
    });
    
    // Get server details
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    // Get teams for this server using server code
    const teams = await StudentTeam.find({ 
      projectServer: server.code 
    })
    .populate('members', 'firstName lastName email')
    .populate('creator', 'firstName lastName email')
    .sort({ createdAt: -1 });

    logWithTimestamp('info', 'Teams fetched successfully', {
      serverId,
      serverCode: server.code,
      teamCount: teams.length
    });

    res.json({
      success: true,
      teams: teams || [],
      serverCode: server.code
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching teams for server', {
      error: error.message,
      serverId: req.params.serverId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams for server',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET STUDENT'S TEAMS - Modified to accept studentId as query param
router.get('/student-teams', async (req, res) => {
  try {
    const { studentId } = req.query;
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId query parameter is required'
      });
    }

    logWithTimestamp('info', 'Fetching student teams', {
      studentId: studentId
    });

    const teams = await StudentTeam.find({
      members: studentId
    })
    .populate('members', 'firstName lastName email')
    .populate('creator', 'firstName lastName email')
    .sort({ createdAt: -1 });

    // Get server details for each team
    const teamsWithServerDetails = await Promise.all(
      teams.map(async (team) => {
        const server = await ProjectServer.findOne({ code: team.projectServer });
        return {
          ...team.toObject(),
          serverDetails: server ? {
            id: server._id,
            title: server.title,
            description: server.description
          } : null
        };
      })
    );

    logWithTimestamp('info', 'Student teams fetched successfully', {
      studentId: studentId,
      teamCount: teams.length
    });

    res.json({
      success: true,
      teams: teamsWithServerDetails,
      totalTeams: teams.length,
      message: teams.length === 0 ? 'No teams found. Join or create a team to get started.' : `Found ${teams.length} teams`
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching student teams', {
      error: error.message,
      studentId: req.query.studentId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET ALL TEAMS FOR FACULTY - Modified to accept facultyId as query param
router.get('/faculty-teams', async (req, res) => {
  try {
    const { facultyId } = req.query;
    
    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId query parameter is required'
      });
    }

    logWithTimestamp('info', 'Fetching faculty teams', {
      facultyId: facultyId
    });

    // Get all servers owned by this faculty
    const facultyServers = await ProjectServer.find({
      faculty: facultyId
    });

    const serverCodes = facultyServers.map(server => server.code);

    // Get all teams for faculty's servers
    const teams = await StudentTeam.find({
      projectServer: { $in: serverCodes }
    })
    .populate('members', 'firstName lastName email')
    .populate('creator', 'firstName lastName email')
    .sort({ createdAt: -1 });

    // Add server details to each team
    const teamsWithServerDetails = teams.map(team => {
      const server = facultyServers.find(s => s.code === team.projectServer);
      return {
        ...team.toObject(),
        serverDetails: server ? {
          id: server._id,
          title: server.title,
          description: server.description
        } : null
      };
    });

    logWithTimestamp('info', 'Faculty teams fetched successfully', {
      facultyId: facultyId,
      teamCount: teams.length,
      serverCount: facultyServers.length
    });

    res.json({
      success: true,
      teams: teamsWithServerDetails,
      totalTeams: teams.length,
      totalServers: facultyServers.length
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching faculty teams', {
      error: error.message,
      facultyId: req.query.facultyId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ JOIN TEAM - Modified to accept userId in body
router.post('/join/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId, userRole } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required in request body'
      });
    }

    const role = userRole || 'student';
    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can join teams'
      });
    }

    const team = await StudentTeam.findById(teamId)
      .populate('members', 'firstName lastName email');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if student is already a member
    if (team.members.some(member => member._id.toString() === userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this team'
      });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Team is full'
      });
    }

    // Check if student is already in another team for this server
    const existingTeam = await StudentTeam.findOne({
      projectServer: team.projectServer,
      members: userId,
      _id: { $ne: teamId }
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'User is already in another team for this project server'
      });
    }

    // Add student to team
    team.members.push(userId);
    await team.save();

    const updatedTeam = await StudentTeam.findById(teamId)
      .populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email');

    logWithTimestamp('info', 'Student joined team successfully', {
      teamId,
      studentId: userId,
      teamName: team.name
    });

    res.json({
      success: true,
      message: 'Successfully joined team',
      team: updatedTeam
    });

  } catch (error) {
    logWithTimestamp('error', 'Error joining team', {
      error: error.message,
      teamId: req.params.teamId,
      userId: req.body.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to join team',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ LEAVE TEAM - Modified to accept userId in body
router.post('/leave/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId, userRole } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required in request body'
      });
    }

    const role = userRole || 'student';
    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can leave teams'
      });
    }

    const team = await StudentTeam.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if student is a member
    if (!team.members.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this team'
      });
    }

    // Remove student from team
    team.members = team.members.filter(memberId => memberId.toString() !== userId);

    // If team becomes empty, delete it
    if (team.members.length === 0) {
      await StudentTeam.findByIdAndDelete(teamId);
      
      logWithTimestamp('info', 'Team deleted (no members left)', {
        teamId,
        teamName: team.name
      });

      return res.json({
        success: true,
        message: 'Left team successfully (team was deleted as no members remained)'
      });
    }

    // If the leaving member was the creator, assign a new creator
    if (team.creator.toString() === userId) {
      team.creator = team.members[0];
    }

    await team.save();

    const updatedTeam = await StudentTeam.findById(teamId)
      .populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email');

    logWithTimestamp('info', 'Student left team successfully', {
      teamId,
      studentId: userId,
      teamName: team.name,
      remainingMembers: team.members.length
    });

    res.json({
      success: true,
      message: 'Left team successfully',
      team: updatedTeam
    });

  } catch (error) {
    logWithTimestamp('error', 'Error leaving team', {
      error: error.message,
      teamId: req.params.teamId,
      userId: req.body.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to leave team',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ DELETE TEAM - Modified to accept userId in body
router.delete('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId, userRole } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required in request body'
      });
    }

    const team = await StudentTeam.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check permissions - only team creator or faculty can delete
    let canDelete = false;
    const role = userRole || 'student';

    if (role === 'student') {
      canDelete = team.creator.toString() === userId;
    } else if (role === 'faculty') {
      // Check if faculty owns the server
      const server = await ProjectServer.findOne({
        code: team.projectServer,
        faculty: userId
      });
      canDelete = !!server;
    }

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this team'
      });
    }

    await StudentTeam.findByIdAndDelete(teamId);

    logWithTimestamp('info', 'Team deleted successfully', {
      teamId,
      teamName: team.name,
      deletedBy: userId,
      userRole: role
    });

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });

  } catch (error) {
    logWithTimestamp('error', 'Error deleting team', {
      error: error.message,
      teamId: req.params.teamId,
      userId: req.body.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete team',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ SEARCH TEAMS
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { serverCode } = req.query;

    logWithTimestamp('info', 'Searching teams', {
      query,
      serverCode
    });

    let searchCriteria = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };

    if (serverCode) {
      searchCriteria.projectServer = serverCode.toUpperCase();
    }

    const teams = await StudentTeam.find(searchCriteria)
      .populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email')
      .limit(20)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      teams,
      query,
      count: teams.length
    });

  } catch (error) {
    logWithTimestamp('error', 'Error searching teams', {
      error: error.message,
      query: req.params.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to search teams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TEAM DETAILS
router.get('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await StudentTeam.findById(teamId)
      .populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Get server details
    const server = await ProjectServer.findOne({ code: team.projectServer });

    const teamWithDetails = {
      ...team.toObject(),
      serverDetails: server ? {
        id: server._id,
        title: server.title,
        description: server.description
      } : null
    };

    res.json({
      success: true,
      team: teamWithDetails
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching team details', {
      error: error.message,
      teamId: req.params.teamId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch team details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ UPDATE TEAM - Modified to accept userId in body
router.put('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, description, maxMembers, userId, userRole } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required in request body'
      });
    }

    const team = await StudentTeam.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check permissions - only team creator can update
    const role = userRole || 'student';
    if (role !== 'student' || team.creator.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the team creator can update team details'
      });
    }

    // Validate max members (cannot be less than current member count)
    if (maxMembers && maxMembers < team.members.length) {
      return res.status(400).json({
        success: false,
        message: `Maximum members cannot be less than current member count (${team.members.length})`
      });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (maxMembers) updateData.maxMembers = maxMembers;

    const updatedTeam = await StudentTeam.findByIdAndUpdate(
      teamId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('members', 'firstName lastName email')
    .populate('creator', 'firstName lastName email');

    logWithTimestamp('info', 'Team updated successfully', {
      teamId,
      teamName: updatedTeam.name,
      updatedBy: userId
    });

    res.json({
      success: true,
      message: 'Team updated successfully',
      team: updatedTeam
    });

  } catch (error) {
    logWithTimestamp('error', 'Error updating team', {
      error: error.message,
      teamId: req.params.teamId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update team',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;