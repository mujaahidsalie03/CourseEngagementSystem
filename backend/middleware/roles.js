// middleware/roles.js
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