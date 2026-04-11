const jwt = require('jsonwebtoken');

/**
 * JWT verification middleware.
 * Apply to any route that requires authentication:
 *   router.get('/protected', authMiddleware, handler)
 *
 * Attaches decoded payload to req.user: { phone, iat, exp }
 */
module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token';
    return res.status(401).json({ error: message });
  }
};
