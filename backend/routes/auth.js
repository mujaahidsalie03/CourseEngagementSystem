const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// helper to sign JWT and shape response
function toAuthResponse(user) {
  const payload = { _id: user._id.toString(), email: user.email, name: user.name, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { token, user: payload };
}

// Register (returns token+user so you can log in right away)
router.post('/register', async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: 'name, email, role, password required' });
    }
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    user = await User.create({ name, email, role, passwordHash });

    res.status(201).json(toAuthResponse(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(400).json({ error: 'Invalid email or password' });

    const payload = { _id: user._id.toString(), email: user.email, name: user.name, role: user.role };
    const token = require('jsonwebtoken').sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});


// Quick health-check
router.get('/register', (req, res) => res.send('Auth route works!'));

// Me (optional helper to verify tokens in Postman)
router.get('/me', (req, res) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ user: payload });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
