const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const StudentTeam = require("../models/studentTeamSchema");
const ProjectServer = require("../models/projectServerSchema");
const Task = require("../models/taskSchema");

console.log("🔧 analyticsRoutes.js loaded");

// ✅ Faculty Analytics
router.get("/faculty", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ 
        message: "Only faculty can access this endpoint",
        success: false 
      });
    }

    // Get faculty's servers
    const servers = await ProjectServer.find({ faculty: req.user.id });
    const serverCodes = servers.map(s => s.code);
    const serverIds = servers.map(s => s._id);

    // Get teams in faculty's servers
    const teams = await StudentTeam.find({ 
      projectServer: { $in: serverCodes } 
    }).populate('members');

    // Get tasks created by faculty
    const tasks = await Task.find({ 
      server: { $in: serverIds }
    });

    // Calculate analytics
    const analytics = {
      serversCount: servers.length,
      teamsCount: teams.length,
      tasksCount: tasks.length,
      studentsCount: new Set(teams.flatMap(team => 
        team.members.map(m => m._id.toString())
      )).size,
      recentActivity: {
        newTeamsThisWeek: teams.filter(t => 
          new Date(t.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length,
        newTasksThisWeek: tasks.filter(t => 
          new Date(t.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length
      },
      taskStats: {
        activeTasks: tasks.filter(t => t.status === 'active').length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        gradedTasks: tasks.filter(t => t.status === 'graded').length
      }
    };

    res.json({
      success: true,
      analytics
    });

  } catch (err) {
    console.error("Error fetching faculty analytics:", err);
    res.status(500).json({ 
      message: "Failed to fetch analytics", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Student Analytics
router.get("/student", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can access this endpoint",
        success: false 
      });
    }

    // Get student's teams
    const teams = await StudentTeam.find({ members: req.user.id });
    
    // Get tasks from student's teams' servers
    const serverCodes = teams.map(t => t.projectServer);
    const servers = await ProjectServer.find({ code: { $in: serverCodes } });
    const serverIds = servers.map(s => s._id);
    
    const tasks = await Task.find({ 
      server: { $in: serverIds }
    }).populate('submissions');

    // Calculate student analytics
    const analytics = {
      teamsCount: teams.length,
      serversCount: servers.length,
      tasksCount: tasks.length,
      completedTasks: tasks.filter(t => 
        t.submissions?.some(s => s.student?.toString() === req.user.id)
      ).length,
      averageGrade: 0, // Calculate based on graded submissions
      onTimeSubmissions: 0 // Calculate based on submission dates
    };

    res.json({
      success: true,
      analytics
    });

  } catch (err) {
    console.error("Error fetching student analytics:", err);
    res.status(500).json({ 
      message: "Failed to fetch analytics", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

module.exports = router;