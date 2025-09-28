// middleware/roles.js
// middleware/roles.js
// Role-based access control (RBAC) middleware.
// Usage:
//   const requireRole = require('./middleware/roles');
//   app.post('/api/courses', auth, requireRole('lecturer'), handler);
//   app.delete('/api/quizzes/:id', auth, requireRole(['lecturer','admin']), handler);
//
// Assumes a prior auth middleware has set req.user = { _id, role }.
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const userRoles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

module.exports = requireRole;