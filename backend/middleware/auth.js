// middleware/auth.js
// Attaches req.user from userId/role found in body, headers, or query params.
module.exports = (req, res, next) => {
  // Always have a body object
  // Ensure req.body exists (some routes may not parse a body).
  // If a body parser (express.json/urlencoded) already ran, this is a no-op.
  req.body = req.body || {};

  // Allow user in body, headers, or query (dev mode)
  // Accept user identity from multiple places to make local testing easy.
  // Precedence: body > headers > query.
  const bodyId = req.body.userId;
  const bodyRole = req.body.role;

  // Common dev headers you’ve been using with the proxy / frontend.
  const headerId = req.header('x-user-id');
  const headerRole = req.header('x-user-role');

  // Fallback to query string (e.g., ?userId=...&role=...).
  const queryId = req.query.userId;
  const queryRole = req.query.role;

  // Pick the first available userId/role across the three sources.
  const userId = bodyId || headerId || queryId;
  const role = bodyRole || headerRole || queryRole;

  // If we have *any* userId, consider the request "authenticated" for dev.
  if (userId) {
    req.user = { _id: userId, role: role || 'student' };
  }
  next(); //continue to next route/middleware handler
};
