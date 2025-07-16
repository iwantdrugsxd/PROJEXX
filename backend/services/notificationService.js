const Notification = require('../models/notificationSchema');
const Faculty = require('../models/facultySchema');
const Student = require('../models/studentSchema');

class NotificationService {
  // Send notification to faculty when team joins project server
  static async notifyTeamJoinedServer(projectServer, team, students) {
    try {
      const notification = new Notification({
        recipient: projectServer.faculty,
        recipientModel: 'Faculty',
        type: 'team_joined',
        title: 'New Team Joined Your Project',
        message: `Team "${team.name}" with ${students.length} students has joined "${projectServer.title}"`,
        data: {
          serverId: projectServer._id,
          teamId: team._id
        }
      });
      
      await notification.save();
      
      // Send real-time notification if using Socket.io
      if (global.io) {
        global.io.to(`faculty_${projectServer.faculty}`).emit('notification', notification);
      }
      
      return notification;
    } catch (error) {
      console.error('Failed to send team joined notification:', error);
    }
  }

  // Send notification when task is assigned
  static async notifyTaskAssigned(task, team, projectServer) {
    try {
      // Notify all team members
      const notifications = team.members.map(studentId => ({
        recipient: studentId,
        recipientModel: 'Student',
        sender: task.faculty,
        senderModel: 'Faculty',
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `You have a new task: "${task.title}" in ${projectServer.title}`,
        data: {
          taskId: task._id,
          teamId: team._id,
          serverId: projectServer._id
        }
      }));
      
      const created = await Notification.insertMany(notifications);
      
      // Send real-time notifications
      if (global.io) {
        team.members.forEach(studentId => {
          global.io.to(`student_${studentId}`).emit('notification', {
            type: 'task_assigned',
            task: task
          });
        });
      }
      
      return created;
    } catch (error) {
      console.error('Failed to send task assigned notifications:', error);
    }
  }

  // Send notification when task is submitted
  static async notifyTaskSubmitted(task, submission, student) {
    try {
      const notification = new Notification({
        recipient: task.faculty,
        recipientModel: 'Faculty',
        sender: student._id,
        senderModel: 'Student',
        type: 'task_submitted',
        title: 'Task Submitted',
        message: `${student.firstName} ${student.lastName} has submitted "${task.title}"`,
        data: {
          taskId: task._id,
          studentId: student._id,
          submissionId: submission._id
        }
      });
      
      await notification.save();
      
      // Send real-time notification
      if (global.io) {
        global.io.to(`faculty_${task.faculty}`).emit('notification', notification);
      }
      
      return notification;
    } catch (error) {
      console.error('Failed to send task submitted notification:', error);
    }
  }

  // Send notification when task is verified
  static async notifyTaskVerified(task, student, grade, feedback) {
    try {
      const notification = new Notification({
        recipient: student._id,
        recipientModel: 'Student',
        sender: task.faculty,
        senderModel: 'Faculty',
        type: 'task_verified',
        title: 'Task Graded',
        message: `Your submission for "${task.title}" has been graded: ${grade}/${task.maxPoints}`,
        data: {
          taskId: task._id,
          grade: grade,
          feedback: feedback
        }
      });
      
      await notification.save();
      
      // Send real-time notification
      if (global.io) {
        global.io.to(`student_${student._id}`).emit('notification', notification);
      }
      
      return notification;
    } catch (error) {
      console.error('Failed to send task verified notification:', error);
    }
  }

  // Get notifications for a user
  static async getUserNotifications(userId, userModel, limit = 20, skip = 0) {
    try {
      const notifications = await Notification.find({
        recipient: userId,
        recipientModel: userModel
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('sender', 'firstName lastName email')
      .populate('data.serverId', 'title code')
      .populate('data.teamId', 'name')
      .populate('data.taskId', 'title');
      
      return notifications;
    } catch (error) {
      console.error('Failed to get user notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );
      
      return notification;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  // Get unread count
  static async getUnreadCount(userId, userModel) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        recipientModel: userModel,
        isRead: false
      });
      
      return count;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }
}

module.exports = NotificationService;