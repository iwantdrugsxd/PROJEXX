const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const StudentTeam = require("../models/studentTeamSchema");
const ProjectServer = require("../models/projectServerSchema");
const Task = require("../models/taskSchema");
const mongoose = require('mongoose');
console.log("🔧 analyticsRoutes.js loaded");

// ✅ Faculty Analytics
router.get("/faculty", verifyToken, async (req, res) => {
  try {
    console.log(`📊 Faculty ${req.user.id} requesting analytics`);

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

    console.log(`📊 Faculty has ${servers.length} servers`);

    // Get teams in faculty's servers
    const teams = await StudentTeam.find({ 
      projectServer: { $in: serverCodes } 
    }).populate('members');

    console.log(`📊 Found ${teams.length} teams across all servers`);

    // Get tasks created by faculty
    const tasks = await Task.find({ 
      server: { $in: serverIds }
    });

    console.log(`📊 Found ${tasks.length} tasks across all servers`);

    // Calculate unique students
    const uniqueStudents = new Set();
    teams.forEach(team => {
      team.members.forEach(member => {
        uniqueStudents.add(member._id.toString());
      });
    });

    // Calculate week boundaries
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Calculate analytics
    const analytics = {
      serversCount: servers.length,
      teamsCount: teams.length,
      tasksCount: tasks.length,
      studentsCount: uniqueStudents.size,
      recentActivity: {
        newTeamsThisWeek: teams.filter(t => 
          new Date(t.createdAt) > oneWeekAgo
        ).length,
        newTasksThisWeek: tasks.filter(t => 
          new Date(t.createdAt) > oneWeekAgo
        ).length
      },
      taskStats: {
        activeTasks: tasks.filter(t => t.status === 'active' || !t.status).length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        gradedTasks: tasks.filter(t => t.status === 'graded').length,
        totalSubmissions: tasks.reduce((sum, task) => sum + (task.submissions?.length || 0), 0)
      },
      serverBreakdown: servers.map(server => {
        const serverTeams = teams.filter(t => t.projectServer === server.code);
        const serverTasks = tasks.filter(t => t.server.toString() === server._id.toString());
        const serverStudents = new Set();
        serverTeams.forEach(team => {
          team.members.forEach(member => {
            serverStudents.add(member._id.toString());
          });
        });

        return {
          serverId: server._id,
          serverTitle: server.title,
          serverCode: server.code,
          teamsCount: serverTeams.length,
          tasksCount: serverTasks.length,
          studentsCount: serverStudents.size,
          lastActivity: serverTeams.length > 0 ? 
            Math.max(...serverTeams.map(t => new Date(t.createdAt).getTime())) : 
            server.updatedAt
        };
      })
    };

    console.log(`✅ Analytics calculated: ${analytics.serversCount} servers, ${analytics.teamsCount} teams, ${analytics.studentsCount} students`);

    res.json({
      success: true,
      analytics,
      message: "Analytics retrieved successfully"
    });

  } catch (err) {
    console.error("❌ Error fetching faculty analytics:", err);
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
    console.log(`📊 Student ${req.user.id} requesting analytics`);

    if (req.user.role !== "student") {
      return res.status(403).json({ 
        message: "Only students can access this endpoint",
        success: false 
      });
    }

    // Get student's teams
    const teams = await StudentTeam.find({ members: req.user.id })
      .populate('members', 'firstName lastName email');
    
    console.log(`📊 Student is in ${teams.length} teams`);

    // Get tasks from student's teams' servers
    const serverCodes = teams.map(t => t.projectServer);
    const servers = await ProjectServer.find({ code: { $in: serverCodes } });
    const serverIds = servers.map(s => s._id);
    
    const tasks = await Task.find({ 
      server: { $in: serverIds }
    }).populate('submissions');

    console.log(`📊 Found ${tasks.length} tasks for student`);

    // Calculate student-specific analytics
    const studentSubmissions = [];
    const completedTasks = [];
    let totalGradePoints = 0;
    let gradedTasksCount = 0;
    let onTimeSubmissions = 0;

    tasks.forEach(task => {
      const submission = task.submissions?.find(s => 
        s.student?.toString() === req.user.id
      );
      
      if (submission) {
        studentSubmissions.push(submission);
        completedTasks.push(task);
        
        // Check if graded
        if (submission.grade !== undefined && submission.grade !== null) {
          totalGradePoints += submission.grade;
          gradedTasksCount++;
        }
        
        // Check if submitted on time
        if (task.dueDate && submission.submittedAt) {
          const isOnTime = new Date(submission.submittedAt) <= new Date(task.dueDate);
          if (isOnTime) {
            onTimeSubmissions++;
          }
        }
      }
    });

    const averageGrade = gradedTasksCount > 0 ? totalGradePoints / gradedTasksCount : 0;
    const completionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
    const onTimeRate = studentSubmissions.length > 0 ? (onTimeSubmissions / studentSubmissions.length) * 100 : 0;

    // Calculate week boundaries
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const analytics = {
      teamsCount: teams.length,
      serversCount: servers.length,
      tasksCount: tasks.length,
      completedTasks: completedTasks.length,
      pendingTasks: tasks.length - completedTasks.length,
      averageGrade: parseFloat(averageGrade.toFixed(2)),
      completionRate: parseFloat(completionRate.toFixed(1)),
      onTimeSubmissions: onTimeSubmissions,
      onTimeRate: parseFloat(onTimeRate.toFixed(1)),
      recentActivity: {
        newTeamsJoinedThisWeek: teams.filter(t => 
          new Date(t.createdAt) > oneWeekAgo
        ).length,
        submissionsThisWeek: studentSubmissions.filter(s => 
          new Date(s.submittedAt) > oneWeekAgo
        ).length
      },
      teamBreakdown: teams.map(team => ({
        teamId: team._id,
        teamName: team.name,
        serverCode: team.projectServer,
        membersCount: team.members.length,
        joinedAt: team.createdAt
      })),
      gradeDistribution: {
        A: studentSubmissions.filter(s => s.grade >= 90).length,
        B: studentSubmissions.filter(s => s.grade >= 80 && s.grade < 90).length,
        C: studentSubmissions.filter(s => s.grade >= 70 && s.grade < 80).length,
        D: studentSubmissions.filter(s => s.grade >= 60 && s.grade < 70).length,
        F: studentSubmissions.filter(s => s.grade < 60).length
      }
    };

    console.log(`✅ Student analytics calculated: ${analytics.completedTasks}/${analytics.tasksCount} tasks completed`);

    res.json({
      success: true,
      analytics,
      message: "Student analytics retrieved successfully"
    });

  } catch (err) {
    console.error("❌ Error fetching student analytics:", err);
    res.status(500).json({ 
      message: "Failed to fetch analytics", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Server-specific analytics (for both faculty and students)
router.get("/server/:serverId", verifyToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    console.log(`📊 User ${req.user.id} requesting analytics for server ${serverId}`);

    // Get server
    const server = await ProjectServer.findById(serverId);
    if (!server) {
      return res.status(404).json({
        message: "Server not found",
        success: false
      });
    }

    // Check access permissions
    if (req.user.role === "faculty" && server.faculty.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Access denied - not your server",
        success: false
      });
    }

    if (req.user.role === "student") {
      // Check if student is in any team for this server
      const studentTeam = await StudentTeam.findOne({
        projectServer: server.code,
        members: req.user.id
      });
      
      if (!studentTeam) {
        return res.status(403).json({
          message: "Access denied - not a member of this server",
          success: false
        });
      }
    }

    // Get server data
    const teams = await StudentTeam.find({ projectServer: server.code })
      .populate('members', 'firstName lastName email');
    
    const tasks = await Task.find({ server: serverId })
      .populate('submissions');

    // Calculate unique students
    const uniqueStudents = new Set();
    teams.forEach(team => {
      team.members.forEach(member => {
        uniqueStudents.add(member._id.toString());
      });
    });

    // Task statistics
    const taskStats = {
      total: tasks.length,
      active: tasks.filter(t => t.status === 'active' || !t.status).length,
      completed: tasks.filter(t => t.status === 'completed').length,
      graded: tasks.filter(t => t.status === 'graded').length
    };

    // Submission statistics
    const allSubmissions = tasks.flatMap(task => task.submissions || []);
    const gradedSubmissions = allSubmissions.filter(s => s.grade !== undefined && s.grade !== null);
    const averageGrade = gradedSubmissions.length > 0 ? 
      gradedSubmissions.reduce((sum, s) => sum + s.grade, 0) / gradedSubmissions.length : 0;

    const analytics = {
      server: {
        id: server._id,
        title: server.title,
        code: server.code,
        description: server.description,
        createdAt: server.createdAt
      },
      teamsCount: teams.length,
      studentsCount: uniqueStudents.size,
      taskStats,
      submissionStats: {
        total: allSubmissions.length,
        graded: gradedSubmissions.length,
        averageGrade: parseFloat(averageGrade.toFixed(2))
      },
      engagement: {
        activeTeams: teams.filter(t => {
          // Consider team active if they have recent submissions
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return allSubmissions.some(s => 
            t.members.some(m => m._id.toString() === s.student?.toString()) &&
            new Date(s.submittedAt) > oneWeekAgo
          );
        }).length,
        submissionRate: tasks.length > 0 ? (allSubmissions.length / (tasks.length * uniqueStudents.size)) * 100 : 0
      }
    };

    console.log(`✅ Server analytics calculated for ${server.title}`);

    res.json({
      success: true,
      analytics,
      message: "Server analytics retrieved successfully"
    });

  } catch (err) {
    console.error("❌ Error fetching server analytics:", err);
    res.status(500).json({
      message: "Failed to fetch server analytics",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false
    });
  }
});

// ✅ Overall platform analytics (admin/faculty only)
router.get("/platform", verifyToken, async (req, res) => {
  try {
    console.log(`📊 Platform analytics requested by ${req.user.id} (${req.user.role})`);

    if (req.user.role !== "faculty") {
      return res.status(403).json({
        message: "Only faculty can access platform analytics",
        success: false
      });
    }

    // Get all platform data
    const totalServers = await ProjectServer.countDocuments();
    const totalTeams = await StudentTeam.countDocuments();
    const totalTasks = await Task.countDocuments();
    
    // Get faculty's specific data
    const facultyServers = await ProjectServer.find({ faculty: req.user.id });
    const facultyServerCodes = facultyServers.map(s => s.code);
    const facultyTeams = await StudentTeam.find({ 
      projectServer: { $in: facultyServerCodes } 
    });

    // Calculate time periods
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const analytics = {
      platform: {
        totalServers,
        totalTeams,
        totalTasks,
        lastUpdated: now
      },
      facultyData: {
        serversCount: facultyServers.length,
        teamsCount: facultyTeams.length,
        tasksCount: await Task.countDocuments({ 
          server: { $in: facultyServers.map(s => s._id) }
        })
      },
      growth: {
        serversThisWeek: await ProjectServer.countDocuments({ 
          createdAt: { $gte: oneWeekAgo }
        }),
        serversThisMonth: await ProjectServer.countDocuments({ 
          createdAt: { $gte: oneMonthAgo }
        }),
        teamsThisWeek: await StudentTeam.countDocuments({ 
          createdAt: { $gte: oneWeekAgo }
        }),
        teamsThisMonth: await StudentTeam.countDocuments({ 
          createdAt: { $gte: oneMonthAgo }
        })
      }
    };

    console.log(`✅ Platform analytics calculated`);

    res.json({
      success: true,
      analytics,
      message: "Platform analytics retrieved successfully"
    });

  } catch (err) {
    console.error("❌ Error fetching platform analytics:", err);
    res.status(500).json({
      message: "Failed to fetch platform analytics",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false
    });
  }
});

module.exports = router;