// controllers/authController.js
// Basic auth controller
// NB: passwordHash is not actually hashed, just kept for naming convention, removed bcrypt hashing
const User = require('../models/userModel');


// Register a new user 
// POST /api/auth/register
// access  Public
exports.register = async (req, res) => {
  try {
    // Destructure expected fields from request body.
    // Default role to 'student' if not provided.
    const { name, email, password, role = 'student' } = req.body;
    
    //just a quick validation check of input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, password required' });
    }

    // Check if user already exists with that email
    //lean() because just need to fetch plain object, mongo features not really needed here
    const exists = await User.findOne({ email }).lean();
    if (exists) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Create user without password hashing - i've kept the naming so it doesnt change in the db side.
    const user = await User.create({ 
      name, 
      email, 
      passwordHash: password, // Store plain password
      role 
    });

    // Respond with minimal user info (no token returned).
    res.status(201).json({ 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      },
      message: 'User created successfully (dev mode - no token)'
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

//Login user 
// route   POST /api/auth/login
// access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    //quick validation (minimal)
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Find user by their email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Simple password check, without any JWT checking.
    if (user.passwordHash !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Return user data without token (successful login)
    res.json({ 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      },
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};