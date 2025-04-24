/**
 * Middleware for authentication and authorization
 */

// Ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Vui lòng đăng nhập để tiếp tục');
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

module.exports = {
  ensureAuthenticated,
  ensureGuest,
  ensureAdmin,
  apiAuth,
  apiAdmin
}; 