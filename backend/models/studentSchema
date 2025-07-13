// models/Student.js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username:{ type: String, required: true, unique: true },
  phone: { type: String },
    password: { type: String, required: true }, // Hashed
  role: { type: String, default: 'Student' },
  joinedTeams: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentTeam",
      required:false,
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Student", studentSchema);
