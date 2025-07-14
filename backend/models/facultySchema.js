// models/Faculty.js
const mongoose = require("mongoose");

const facultySchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Hashed
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Faculty", facultySchema);
