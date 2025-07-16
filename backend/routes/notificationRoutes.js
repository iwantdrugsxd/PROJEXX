const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notificationService');
const verifyToken = require('../middleware/verifyToken');

// Get user notifications
router.get('/my-notifications', verifyToken, async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    const userModel = req.user.role === 'faculty' ? 'Faculty' : 'Student';
    
    const notifications = await NotificationService.getUserNotifications(
      req.user.id,
      userModel,
      parseInt(limit),
      parseInt(skip)
    );
    
    const unreadCount = await NotificationService.getUnreadCount(req.user.id, userModel);
    
    res.json({
      success: true,
      notifications,
      unreadCount,
      total: notifications.length
    });
  } catch (error) {
    console.error('Failed to get notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// Mark notification as read
router.put('/:notificationId/read', verifyToken, async (req, res) => {
  try {
    const notification = await NotificationService.markAsRead(
      req.params.notificationId,
      req.user.id
    );
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification'
    });
  }
});

// Mark all as read
router.put('/mark-all-read', verifyToken, async (req, res) => {
  try {
    const userModel = req.user.role === 'faculty' ? 'Faculty' : 'Student';
    
    await Notification.updateMany(
      {
        recipient: req.user.id,
        recipientModel: userModel,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Failed to mark all as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications'
    });
  }
});

module.exports = router;