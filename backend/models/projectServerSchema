// models/ProjectServer.js
const mongoose = require("mongoose");

const projectServerSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // e.g., PRJ-XYZ123
  title: { type: String, required: true },
  description: { type: String },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Faculty",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ProjectServer", projectServerSchema);
