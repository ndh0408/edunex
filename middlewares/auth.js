/**
 * Middleware for authentication and authorization
 */

const jwt = require('jsonwebtoken');


// Ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    // Check if user's email is verified
    if (!req.user.isVerified) {
      req.flash('error', 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn.');
      req.logout(function(err) {
        if (err) { console.error(err); }
        return res.redirect('/users/login');
      });
      return;
    }
    return next();
  }
  req.flash('error', 'Vui lòng đăng nhập để truy cập trang này');
  res.redirect('/users/login');
};

// Ensure guest (not logged in)
const ensureGuest = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
};

// Admin access only
const ensureAdmin = (req, res, next) => {
  if (req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'manager')) {
    return next();
  }
  req.flash('error_msg', 'Bạn không có quyền truy cập trang này');
  res.redirect('/');
};

// API authentication
const apiAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  return res.status(401).json({
    success: false,
    message: 'Không được phép truy cập, vui lòng đăng nhập'
  });
};

// API admin authorization
const apiAdmin = (req, res, next) => {
  if (req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'manager')) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Không có quyền truy cập'
  });
};

// Check if user is authenticated
const isAuthenticated = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        
        // Add user to request object
        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Check if user is the owner of the resource
const isOwner = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        // Check if user is admin or owner of the resource
        if (req.user.role === 'admin' || req.user._id.toString() === req.params.userId) {
            next();
        } else {
            res.status(403).json({ message: 'Access denied' });
        }
    } catch (error) {
        console.error('Owner check error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '7d'
    });
};

// Set token cookie
const setTokenCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

module.exports = {
  ensureAuthenticated,
  ensureGuest,
  ensureAdmin,
  apiAuth,
  apiAdmin,
  isAuthenticated,
  isAdmin,
  isOwner,
  generateToken,
  setTokenCookie
}; 