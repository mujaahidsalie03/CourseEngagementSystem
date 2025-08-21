// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  try {
    // CORRECTED: Added 'role' to the destructured body.
    const { name, email, role, password } = req.body;
    
    if (!role) {
      return res.status(400).json({ msg: "A role ('student' or 'lecturer') is required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      role, // CORRECTED: Added role to the new user object.
      passwordHash: hashedPassword,
    });

    await newUser.save();
    
    // It's better to just send a success message on register.
    // The user can then proceed to the login page.
    res.status(201).json({ msg: "User registered successfully" });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // CORRECTED: The JWT payload now includes all the necessary user info
    // that your 'auth' middleware expects.
    const payload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "3h" } // Increased expiry time
    );

    res.json({ token, user: payload });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
