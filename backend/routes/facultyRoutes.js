const express = require("express");
const router = express.Router();
const Faculty = require("../models/facultySchema.js");

const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const { jwtSecret, jwtExpiresIn } = require("../config/jwt");
const verifyToken = require("../middleware/verifyToken");


router.get("/dashboard", verifyToken, (req, res) => {
    try{

        res.json({ message: `Hello, ${req.user.role}!`, userId: req.user.id });
    }catch(err){
        console.log(err)
    }
});

// Login (COOKIE-based)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const faculty = await Faculty.findOne({ username });
    if (!faculty) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, faculty.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ id: faculty._id, role: "faculty" }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // Set to true in production (HTTPS)
      sameSite: "Lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.status(200).json({
      message: "Login successful",
      faculty: {
        id: faculty._id,
        name: faculty.firstName + " " + faculty.lastName,
        email: faculty.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
}
});

// Logout
router.post("/logout", (req, res) => {
    try{
        // if(!token) res.status(500).json({ message: "no token", error: err.message });
        res.clearCookie("token");
        res.status(200).json({ message: "Logout successful" });
    }catch(err){
        res.status(500).json({ message: "Logout failed", error: err.message });
        console.log(err)
    }
});

//create faculty
router.post("/createFaculty", async (req, res) => {

try {
    const{
            firstName, lastName, email, phone, username, password} = req.body
        // Check if the user already exists
        const existingUser = await Faculty.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
 
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user without userId, which will be auto-generated
        const newFaculty = new Faculty({
            firstName, lastName, email, phone, username, password:hashedPassword
        });
        console.log("New user object before save:", newFaculty);
        await newFaculty.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;