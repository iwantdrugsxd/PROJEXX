const express = require("express");
const router = express.Router();
const Chat = require("../models/chatSchema");
const Message = require("../models/messageSchema");
const Student = require("../models/studentSchema");
const Faculty = require("../models/facultySchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 messagingRoutes.js loaded");

// ✅ Create new chat
router.post("/chats", verifyToken, async (req, res) => {
  try {
    const { type, participants, name } = req.body;
    
    // Validation
    if (!type || !participants || !Array.isArray(participants)) {
      return res.status(400).json({ 
        message: "Type and participants are required",
        success: false 
      });
    }

    if (type === 'group' && !name) {
      return res.status(400).json({ 
        message: "Group name is required for group chats",
        success: false 
      });
    }

    // Check if direct chat already exists
    if (type === 'direct' && participants.length === 1) {
      const existingChat = await Chat.findOne({
        type: 'direct',
        participants: { $all: [req.user.id, participants[0]] }
      });

      if (existingChat) {
        const populatedExistingChat = await Chat.findById(existingChat._id)
          .populate("participants", "firstName lastName email")
          .populate("createdBy", "firstName lastName email")
          .populate("lastMessage");

        return res.status(200).json({
          success: true,
          chat: populatedExistingChat,
          message: "Chat already exists"
        });
      }
    }
    
    const chat = new Chat({
      type,
      name: type === 'group' ? name : undefined,
      participants: [req.user.id, ...participants],
      createdBy: req.user.id,
      creatorModel: req.user.role === "faculty" ? "Faculty" : "Student"
    });
    
    await chat.save();
    
    const populatedChat = await Chat.findById(chat._id)
      .populate("participants", "firstName lastName email")
      .populate("createdBy", "firstName lastName email");
    
    console.log(`💬 Chat created: ${chat._id} by ${req.user.id}`);
    
    res.status(201).json({
      success: true,
      chat: populatedChat
    });
  } catch (err) {
    console.error("Error creating chat:", err);
    res.status(500).json({ 
      message: "Failed to create chat", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ✅ Get user chats
router.get("/chats", verifyToken, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.id,
      isActive: true
    })
      .populate("participants", "firstName lastName email")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "firstName lastName email"
        }
      })
      .sort({ updatedAt: -1 });
    
    console.log(`📨 Fetched ${chats.length} chats for user ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      chats
    });
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).json({ 
      message: "Failed to fetch chats", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ✅ Get chat messages
router.get("/chats/:chatId/messages", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Check if user is participant in this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        message: "Chat not found", 
        success: false 
      });
    }

    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ 
        message: "Access denied", 
        success: false 
      });
    }
    
    const messages = await Message.find({ chatId })
      .populate("sender", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Reverse to get chronological order
    messages.reverse();
    
    console.log(`📨 Fetched ${messages.length} messages for chat ${chatId}`);
    
    res.status(200).json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ 
      message: "Failed to fetch messages", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ✅ Send message
router.post("/messages", verifyToken, async (req, res) => {
  try {
    const { chatId, content, type = 'text' } = req.body;
    
    // Validation
    if (!chatId || !content) {
      return res.status(400).json({ 
        message: "Chat ID and content are required",
        success: false 
      });
    }

    // Check if user is participant in this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        message: "Chat not found", 
        success: false 
      });
    }

    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ 
        message: "Access denied", 
        success: false 
      });
    }
    
    const message = new Message({
      chatId,
      sender: req.user.id,
      senderModel: req.user.role === "faculty" ? "Faculty" : "Student",
      content: content.trim(),
      type
    });
    
    await message.save();
    
    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date()
    });
    
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "firstName lastName email");
    
    console.log(`📨 Message sent to chat ${chatId} by ${req.user.id}`);
    
    res.status(201).json({
      success: true,
      message: populatedMessage
    });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ 
      message: "Failed to send message", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ✅ Mark messages as read
router.post("/chats/:chatId/read", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Check if user is participant in this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        message: "Chat not found", 
        success: false 
      });
    }

    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ 
        message: "Access denied", 
        success: false 
      });
    }

    // Mark unread messages as read
    await Message.updateMany(
      { 
        chatId,
        sender: { $ne: req.user.id },
        'readBy.user': { $ne: req.user.id }
      },
      { 
        $push: { 
          readBy: { 
            user: req.user.id,
            readAt: new Date()
          }
        }
      }
    );
    
    console.log(`✅ Messages marked as read in chat ${chatId} by ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      message: "Messages marked as read"
    });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    res.status(500).json({ 
      message: "Failed to mark messages as read", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ✅ Get single chat details
router.get("/chats/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const chat = await Chat.findById(chatId)
      .populate("participants", "firstName lastName email")
      .populate("createdBy", "firstName lastName email")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "firstName lastName email"
        }
      });
    
    if (!chat) {
      return res.status(404).json({ 
        message: "Chat not found", 
        success: false 
      });
    }

    if (!chat.participants.some(p => p._id.toString() === req.user.id)) {
      return res.status(403).json({ 
        message: "Access denied", 
        success: false 
      });
    }
    
    res.status(200).json({
      success: true,
      chat
    });
  } catch (err) {
    console.error("Error fetching chat details:", err);
    res.status(500).json({ 
      message: "Failed to fetch chat details", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ✅ Update chat (name, etc.)
router.put("/chats/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name } = req.body;
    
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        message: "Chat not found", 
        success: false 
      });
    }

    // Check if user is creator or participant
    if (chat.createdBy.toString() !== req.user.id && !chat.participants.includes(req.user.id)) {
      return res.status(403).json({ 
        message: "Access denied", 
        success: false 
      });
    }

    // Only creator can update group name
    if (chat.type === 'group' && chat.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "Only chat creator can update group name", 
        success: false 
      });
    }

    if (name) {
      chat.name = name.trim();
    }

    await chat.save();
    
    const updatedChat = await Chat.findById(chatId)
      .populate("participants", "firstName lastName email")
      .populate("createdBy", "firstName lastName email");
    
    console.log(`✏️ Chat ${chatId} updated by ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      chat: updatedChat
    });
  } catch (err) {
    console.error("Error updating chat:", err);
    res.status(500).json({ 
      message: "Failed to update chat", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ✅ Delete/Leave chat
router.delete("/chats/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        message: "Chat not found", 
        success: false 
      });
    }

    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ 
        message: "Access denied", 
        success: false 
      });
    }

    // If it's a direct chat or user is creator, delete the chat
    if (chat.type === 'direct' || chat.createdBy.toString() === req.user.id) {
      await Chat.findByIdAndUpdate(chatId, { isActive: false });
      await Message.updateMany({ chatId }, { isActive: false });
      
      console.log(`🗑️ Chat ${chatId} deleted by ${req.user.id}`);
      
      res.status(200).json({
        success: true,
        message: "Chat deleted successfully"
      });
    } else {
      // Remove user from group chat
      await Chat.findByIdAndUpdate(chatId, {
        $pull: { participants: req.user.id }
      });
      
      console.log(`👋 User ${req.user.id} left chat ${chatId}`);
      
      res.status(200).json({
        success: true,
        message: "Left chat successfully"
      });
    }
  } catch (err) {
    console.error("Error deleting/leaving chat:", err);
    res.status(500).json({ 
      message: "Failed to delete/leave chat", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ✅ Search messages
router.get("/chats/:chatId/search", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ 
        message: "Search query is required", 
        success: false 
      });
    }

    // Check if user is participant in this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        message: "Chat not found", 
        success: false 
      });
    }

    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ 
        message: "Access denied", 
        success: false 
      });
    }
    
    const messages = await Message.find({
      chatId,
      content: { $regex: q.trim(), $options: 'i' },
      isActive: { $ne: false }
    })
      .populate("sender", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    console.log(`🔍 Search in chat ${chatId}: "${q}" - ${messages.length} results`);
    
    res.status(200).json({
      success: true,
      messages,
      query: q.trim(),
      count: messages.length
    });
  } catch (err) {
    console.error("Error searching messages:", err);
    res.status(500).json({ 
      message: "Failed to search messages", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

// ✅ Get online users (for a specific chat)
router.get("/chats/:chatId/online", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Check if user is participant in this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        message: "Chat not found", 
        success: false 
      });
    }

    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ 
        message: "Access denied", 
        success: false 
      });
    }

    // This would typically integrate with Socket.io to get real online status
    // For now, return a placeholder response
    res.status(200).json({
      success: true,
      onlineUsers: [], // This would be populated by Socket.io integration
      message: "Online status requires Socket.io integration"
    });
  } catch (err) {
    console.error("Error fetching online users:", err);
    res.status(500).json({ 
      message: "Failed to fetch online users", 
      success: false,
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
  }
});

console.log("🔧 All messaging routes defined successfully");

module.exports = router;