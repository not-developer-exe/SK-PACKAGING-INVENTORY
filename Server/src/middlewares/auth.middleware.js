const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

exports.protect = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: 'Invalid session' });

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Session is no longer valid' });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      console.error('[AUTH] Middleware error:', error.message);
    }
    return res.status(401).json({ message: 'Authentication required' });
  }
};