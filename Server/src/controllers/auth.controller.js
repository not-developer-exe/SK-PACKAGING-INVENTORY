const User = require('../models/User.model');
const jwt = require('jsonwebtoken');

const generateToken = (id, res) => {
    const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // MUST be false in development (http://localhost)
      sameSite: 'lax',                             // 'lax' allows proxied local dev requests
      maxAge: 12 * 60 * 60 * 1000                   // 12 hours
    });
  };

exports.login = async (req, res) => {
    const { email, password } = req.body;
    console.log(`\n[LOGIN ATTEMPT] Email: '${email}' | Password length: ${password?.length}`);
    
    try {
      const user = await User.findOne({ email });
      
      if (!user) {
        console.log(`[LOGIN FAILED] User not found in database for email: ${email}`);
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      console.log(`[LOGIN STATUS] User found. Is active? ${user.isActive}`);
      
      const isMatch = await user.comparePassword(password);
      console.log(`[LOGIN STATUS] Password match result: ${isMatch}`);
  
      if (user.isActive && isMatch) {
        generateToken(user._id, res);
        console.log(`[LOGIN SUCCESS] Token generated for ${user.email}`);
        return res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
      } else {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
    } catch (error) {
      console.error(`[LOGIN ERROR] Server crashed during login:`, error);
      res.status(500).json({ message: 'Server error during login' });
    }
  };

exports.getMe = async (req, res) => {
  // req.user is set by the protect middleware
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } });
};

exports.logout = (req, res) => {
  res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
  res.json({ message: 'Logged out successfully' });
};