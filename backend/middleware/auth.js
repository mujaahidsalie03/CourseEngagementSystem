const jwt = require('jsonwebtoken');

// export a FUNCTION that returns an Express middleware
module.exports = function auth(required = true) {
  return (req, res, next) => {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;

    if (!token) {
      if (required) return res.status(401).json({ error: 'No token' });
      req.user = null;
      return next();
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload; // {_id, email, name, role}
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};
