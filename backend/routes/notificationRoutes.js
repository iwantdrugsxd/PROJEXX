const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 notificationRoutes.js loaded");

// ✅ Get user notifications
router.get("/", verifyToken, async (req, res) => {
  try {
    // For now, return empty notifications
    // You can implement a proper notification system later
    const notifications = [
      {
        id: 1,
        type: 'info',
        message: 'Welcome to ProjectFlow!',
        read: false,
        createdAt: new Date(),
        user: req.user.id
      }
    ];

    res.json({
      success: true,
      notifications
    });

  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ 
      message: "Failed to fetch notifications", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Mark notification as read
router.patch("/:notificationId/read", verifyToken, async (req, res) => {
  try {
    // Implement when you have a proper notification system
    res.json({
      success: true,
      message: "Notification marked as read"
    });

  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ 
      message: "Failed to update notification", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

// ✅ Mark all notifications as read
router.patch("/mark-all-read", verifyToken, async (req, res) => {
  try {
    // Implement when you have a proper notification system
    res.json({
      success: true,
      message: "All notifications marked as read"
    });

  } catch (err) {
    console.error("Error marking all notifications as read:", err);
    res.status(500).json({ 
      message: "Failed to update notifications", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false 
    });
  }
});

module.exports = router;