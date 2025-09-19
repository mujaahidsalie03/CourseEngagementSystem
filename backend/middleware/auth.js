// middleware/auth.js
const auth = (req, res, next) => {
  // Ensure req.body exists (it should after express.json() middleware)
  if (!req.body) {
    req.body = {};
  }

  // Extract userId and role from request body for development
  const { userId, role } = req.body;

  // Create a mock user object similar to what JWT would provide
  if (userId) {
    req.user = {
      _id: userId,
      role: role || 'student'
    };
  } 
  next();
};

module.exports = auth;