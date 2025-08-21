// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

module.exports = function auth() {
  return async (req, res, next) => {
    try {
      const hdr = req.headers.authorization || '';
      const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
      if (!token) return res.status(401).json({ message: 'No token' });

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      // attach a lightweight user (avoid another DB hit if payload has enough)
      req.user = payload;
      if (!req.user || !req.user._id) {
        const u = await User.findById(payload.id || payload._id).lean();
        if (!u) return res.status(401).json({ message: 'User not found' });
        req.user = { _id: String(u._id), role: u.role, name: u.name, email: u.email };
      }
      return next();
    } catch (e) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
};
