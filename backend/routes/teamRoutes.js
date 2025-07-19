const express = require('express');
const router = express.Router();
const StudentTeam = require('../models/studentTeamSchema'); // ✅ FIXED: Correct import path
const Student = require('../models/studentSchema'); // ✅ FIXED: Correct import path
const ProjectServer = require('../models/projectServerSchema'); // ✅ FIXED: Correct import path
const verifyToken = require('../middleware/verifyToken');

// Utility function for consistent logging
const logWithTimestamp = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
};

// ✅ CREATE TEAM
router.post('/createTeam', verifyToken, async (req, res) => {
  try {
    logWithTimestamp('info', 'Team creation attempt', {
      userId: req.user.id,
      userRole: req.user.role,
      body: req.body
    });

    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can create teams'
      });
    }

    const { name, description, projectServer, maxMembers } = req.body;

    // Validate required fields
    if (!name || !projectServer) {
      return res.status(400).json({
        success: false,
        message: 'Team name and project server code are required'
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
      members: req.user.id
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'You are already in a team for this project server',
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
      creator: req.user.id,
      members: [req.user.id],
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
      creatorId: req.user.id,
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
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create team',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET TEAMS BY SERVER ID (NEW ENDPOINT)
router.get('/server/:serverId/teams', verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    logWithTimestamp('info', 'Fetching teams by server ID', {
      serverId,
      userId: req.user.id,
      userRole: req.user.role
    });
    
    // Get server details
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    // Check access
    if (req.user.role === 'faculty' && server.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
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
      message: 'Failed to fetch teams for server'
    });
  }
});

// ✅ GET STUDENT'S TEAMS
router.get('/student-teams', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Student access required'
      });
    }

    logWithTimestamp('info', 'Fetching student teams', {
      studentId: req.user.id
    });

    const teams = await StudentTeam.find({
      members: req.user.id
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
      studentId: req.user.id,
      teamCount: teams.length
    });

    res.json({
      success: true,
      teams: teamsWithServerDetails
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching student teams', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET ALL TEAMS FOR FACULTY
router.get('/faculty', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Faculty access required'
      });
    }

    logWithTimestamp('info', 'Fetching faculty teams', {
      facultyId: req.user.id
    });

    // Get all servers owned by this faculty
    const facultyServers = await ProjectServer.find({
      faculty: req.user.id
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
      facultyId: req.user.id,
      teamCount: teams.length,
      serverCount: facultyServers.length
    });

    res.json({
      success: true,
      teams: teamsWithServerDetails
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching faculty teams', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET FACULTY TEAMS (ALTERNATIVE ENDPOINT)
router.get('/faculty-teams', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Faculty access required'
      });
    }

    logWithTimestamp('info', 'Fetching faculty teams (alternative endpoint)', {
      facultyId: req.user.id
    });

    // Get all servers owned by this faculty
    const facultyServers = await ProjectServer.find({
      faculty: req.user.id
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

    logWithTimestamp('info', 'Faculty teams fetched successfully (alternative)', {
      facultyId: req.user.id,
      teamCount: teams.length,
      serverCount: facultyServers.length
    });

    res.json({
      success: true,
      teams: teamsWithServerDetails
    });

  } catch (error) {
    logWithTimestamp('error', 'Error fetching faculty teams (alternative)', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ JOIN TEAM
router.post('/join/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;

    if (req.user.role !== 'student') {
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
    if (team.members.some(member => member._id.toString() === req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this team'
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
      members: req.user.id,
      _id: { $ne: teamId }
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'You are already in another team for this project server'
      });
    }

    // Add student to team
    team.members.push(req.user.id);
    await team.save();

    const updatedTeam = await StudentTeam.findById(teamId)
      .populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email');

    logWithTimestamp('info', 'Student joined team successfully', {
      teamId,
      studentId: req.user.id,
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
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to join team',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ LEAVE TEAM
router.post('/leave/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;

    if (req.user.role !== 'student') {
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
    if (!team.members.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this team'
      });
    }

    // Remove student from team
    team.members = team.members.filter(memberId => memberId.toString() !== req.user.id);

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
    if (team.creator.toString() === req.user.id) {
      team.creator = team.members[0];
    }

    await team.save();

    const updatedTeam = await StudentTeam.findById(teamId)
      .populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email');

    logWithTimestamp('info', 'Student left team successfully', {
      teamId,
      studentId: req.user.id,
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
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to leave team',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ DELETE TEAM
router.delete('/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await StudentTeam.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check permissions - only team creator or faculty can delete
    let canDelete = false;

    if (req.user.role === 'student') {
      canDelete = team.creator.toString() === req.user.id;
    } else if (req.user.role === 'faculty') {
      // Check if faculty owns the server
      const server = await ProjectServer.findOne({
        code: team.projectServer,
        faculty: req.user.id
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
      deletedBy: req.user.id,
      userRole: req.user.role
    });

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });

  } catch (error) {
    logWithTimestamp('error', 'Error deleting team', {
      error: error.message,
      teamId: req.params.teamId,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete team',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ SEARCH TEAMS
router.get('/search/:query', verifyToken, async (req, res) => {
  try {
    const { query } = req.params;
    const { serverCode } = req.query;

    logWithTimestamp('info', 'Searching teams', {
      query,
      serverCode,
      userId: req.user.id
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
router.get('/:teamId', verifyToken, async (req, res) => {
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

    // Check access permissions
    let hasAccess = false;

    if (req.user.role === 'student') {
      hasAccess = team.members.some(member => member._id.toString() === req.user.id);
    } else if (req.user.role === 'faculty') {
      const server = await ProjectServer.findOne({
        code: team.projectServer,
        faculty: req.user.id
      });
      hasAccess = !!server;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this team'
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

// ✅ UPDATE TEAM
router.put('/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, description, maxMembers } = req.body;

    const team = await StudentTeam.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check permissions - only team creator can update
    if (req.user.role !== 'student' || team.creator.toString() !== req.user.id) {
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
      updatedBy: req.user.id
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

// ✅ HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Team routes are working',
    timestamp: new Date().toISOString(),
    routes: [
      'POST /api/teamRoutes/createTeam',
      'GET /api/teamRoutes/student-teams',
      'GET /api/teamRoutes/faculty',
      'GET /api/teamRoutes/faculty-teams',
      'GET /api/teamRoutes/server/:serverId/teams',
      'POST /api/teamRoutes/join/:teamId',
      'POST /api/teamRoutes/leave/:teamId',
      'DELETE /api/teamRoutes/:teamId',
      'GET /api/teamRoutes/search/:query',
      'GET /api/teamRoutes/:teamId',
      'PUT /api/teamRoutes/:teamId'
    ]
  });
});

module.exports = router;