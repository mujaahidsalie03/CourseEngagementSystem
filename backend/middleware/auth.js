// middleware/auth.js
module.exports = (req, res, next) => {
  // Always have a body object
  req.body = req.body || {};

  // Allow user in body, headers, or query (dev mode)
  const bodyId = req.body.userId;
  const bodyRole = req.body.role;

  const headerId = req.header('x-user-id');
  const headerRole = req.header('x-user-role');

  const queryId = req.query.userId;
  const queryRole = req.query.role;

  const userId = bodyId || headerId || queryId;
  const role = bodyRole || headerRole || queryRole;

  if (userId) {
    req.user = { _id: userId, role: role || 'student' };
  }
  next();
};
