const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

exports.protect = async (req, res, next) => {
  try {
    console.log(`\n[AUTH CHECK] Route: ${req.originalUrl}`);
    
    let token = req.cookies?.jwt;
    if (!token) {
      console.log('[AUTH FAILED] No JWT cookie found in the request.');
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log(`[AUTH FAILED] Token is valid, but User ID ${decoded.id} no longer exists in DB.`);
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      console.log(`[AUTH FAILED] User ${user.email} is deactivated.`);
      return res.status(401).json({ message: 'User deactivated' });
    }

    console.log(`[AUTH SUCCESS] Access granted to: ${user.email}`);
    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH ERROR] Token verification failed:', error.message);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};