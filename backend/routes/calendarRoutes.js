const express = require("express");
const router = express.Router();
const Event = require("../models/eventSchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 calendarRoutes.js loaded");

// ✅ Create new event
router.post("/events", verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      startDate,
      endDate,
      location,
      isVirtual,
      meetingLink,
      attendees,
      reminders,
      isRecurring,
      recurrenceRule,
      priority
    } = req.body;

    // Validation
    if (!title || !startDate || !endDate) {
      return res.status(400).json({
        message: "Title, start date, and end date are required",
        success: false
      });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        message: "End date must be after start date",
        success: false
      });
    }

    const event = new Event({
      title: title.trim(),
      description: description?.trim() || "",
      type: type || "meeting",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location: location?.trim() || "",
      isVirtual: isVirtual || false,
      meetingLink: meetingLink?.trim() || "",
      createdBy: req.user.id,
      creatorModel: req.user.role === "faculty" ? "Faculty" : "Student",
      attendees: attendees || [],
      reminders: reminders || [15],
      isRecurring: isRecurring || false,
      recurrenceRule: recurrenceRule || "",
      priority: priority || "medium"
    });

    await event.save();

    const populatedEvent = await Event.findById(event._id)
      .populate("createdBy", "firstName lastName email");

    res.status(201).json({
      message: "Event created successfully",
      success: true,
      event: populatedEvent
    });
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({
      message: "Failed to create event",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false
    });
  }
});

// ✅ Get events for user
router.get("/events", verifyToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        $or: [
          { startDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
          { endDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
          { 
            startDate: { $lte: new Date(startDate) },
            endDate: { $gte: new Date(endDate) }
          }
        ]
      };
    }

    const events = await Event.find({
      $and: [
        {
          $or: [
            { createdBy: req.user.id },
            { attendees: req.user.id }
          ]
        },
        dateFilter
      ]
    })
      .populate("createdBy", "firstName lastName email")
      .populate("attendees", "firstName lastName email")
      .sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      events
    });
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({
      message: "Failed to fetch events",
      success: false
    });
  }
});

// ✅ Get specific event
router.get("/events/:eventId", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId)
      .populate("createdBy", "firstName lastName email")
      .populate("attendees", "firstName lastName email");

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
        success: false
      });
    }

    // Check if user has access to this event
    const hasAccess = event.createdBy._id.toString() === req.user.id ||
                     event.attendees.some(attendee => attendee._id.toString() === req.user.id);

    if (!hasAccess) {
      return res.status(403).json({
        message: "Access denied",
        success: false
      });
    }

    res.status(200).json({
      success: true,
      event
    });
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({
      message: "Failed to fetch event",
      success: false
    });
  }
});

// ✅ Update event
router.put("/events/:eventId", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        message: "Event not found",
        success: false
      });
    }

    // Check permissions - only creator can update
    if (event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Only event creator can update the event",
        success: false
      });
    }

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdBy;
    delete updateData.createdAt;

    // Validate dates if provided
    if (updateData.startDate && updateData.endDate) {
      if (new Date(updateData.startDate) >= new Date(updateData.endDate)) {
        return res.status(400).json({
          message: "End date must be after start date",
          success: false
        });
      }
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      updateData,
      { new: true }
    ).populate("createdBy", "firstName lastName email")
     .populate("attendees", "firstName lastName email");

    res.status(200).json({
      message: "Event updated successfully",
      success: true,
      event: updatedEvent
    });
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({
      message: "Failed to update event",
      success: false
    });
  }
});

// ✅ Delete event
router.delete("/events/:eventId", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        message: "Event not found",
        success: false
      });
    }

    // Check permissions - only creator can delete
    if (event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Only event creator can delete the event",
        success: false
      });
    }

    await Event.findByIdAndDelete(eventId);

    res.status(200).json({
      message: "Event deleted successfully",
      success: true
    });
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({
      message: "Failed to delete event",
      success: false
    });
  }
});

// ✅ Get upcoming events
router.get("/upcoming", verifyToken, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const now = new Date();

    const events = await Event.find({
      $or: [
        { createdBy: req.user.id },
        { attendees: req.user.id }
      ],
      startDate: { $gt: now }
    })
      .populate("createdBy", "firstName lastName email")
      .sort({ startDate: 1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      events
    });
  } catch (err) {
    console.error("Error fetching upcoming events:", err);
    res.status(500).json({
      message: "Failed to fetch upcoming events",
      success: false
    });
  }
});

console.log("🔧 All calendar routes defined successfully");

module.exports = router;