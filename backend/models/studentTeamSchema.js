// models/StudentTeam.js
const mongoose = require("mongoose");

const studentTeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
    }
  ],
  projectServer: {
    type: String,
    ref: "ProjectServer",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("StudentTeam", studentTeamSchema);
