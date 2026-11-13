const User = require('../models/User.model');
const jwt = require('jsonwebtoken');

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 12 * 60 * 60 * 1000
});

const generateToken = (id, res) => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.cookie('jwt', token, cookieOptions());
};

exports.login = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password || password.length > 256) {
    return res.status(400).json({ message: 'A valid email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !user.isActive || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    generateToken(user._id, res);
    return res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('[AUTH] Login failed:', error.message);
    return res.status(500).json({ message: 'Unable to sign in right now' });
  }
};

exports.getMe = async (req, res) => {
  return res.json({
    user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role }
  });
};

exports.logout = (req, res) => {
  const { maxAge, ...clearOptions } = cookieOptions();
  res.clearCookie('jwt', clearOptions);
  return res.json({ message: 'Logged out successfully' });
};