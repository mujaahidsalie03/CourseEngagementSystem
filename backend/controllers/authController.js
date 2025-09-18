// controllers/authController.js
const User = require('../models/userModel');

exports.register = async (req, res) => {
  try {
    const { name, email, password, role = 'student' } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, password required' });
    }

    // Check if user already exists
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

    // Return user data without token
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

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Simple password check, without any JWT checking.
    if (user.passwordHash !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Return user data without token
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