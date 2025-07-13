const express = require("express");
const router = express.Router();
const Student = require("../models/studentSchema");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const { jwtSecret, jwtExpiresIn } = require("../config/jwt");
const verifyToken = require("../middleware/verifyToken");

// Login (COOKIE-based)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const student = await Student.findOne({ username });
    if (!student) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ id: student._id, role:student.role }, jwtSecret, {
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
      student: {
        id: student._id,
        name: student.firstName + " " + student.lastName,
        email: student.email,
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
//create student
router.post("/createStudent", async (req, res) => {
try {
    const{
            firstName, lastName, email, phone, username, password} = req.body
        // Check if the user already exists
        const existingUser = await Student.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
 
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user without userId, which will be auto-generated
        const newStudent = new Student({
            firstName, lastName, email, phone, username, password:hashedPassword
        });
        console.log("New user object before save:", newStudent);
        await newStudent.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get("/getAllStudents",verifyToken,async(req,res)=>{
  try {
    const students = await Student.find(); // fetch all documents
    res.status(200).json(students);
  } catch (err) {
    res.status(500).json({ message: "Error fetching students", error: err.message });
  }
})

module.exports = router;