const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { ensureAuthenticated, ensureGuest } = require('../middlewares/auth');
const csrf = require('csurf');

// Initialize CSRF protection
const csrfProtection = csrf({ 
  cookie: {
    key: '_csrf',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  }
});

// Middleware to add CSRF token to locals for GET requests rendering forms
const addCsrfToken = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

// @route   GET /users/refresh-csrf
// @desc    Get a fresh CSRF token for AJAX requests
// @access  Public
router.get('/refresh-csrf', csrfProtection, (req, res) => {
  return res.json({ csrfToken: req.csrfToken() });
});

// @route   GET /users/register
// @desc    Show register page
// @access  Public (Guest only)
router.get('/register', ensureGuest, csrfProtection, addCsrfToken, userController.showRegisterPage);

// @route   POST /users/register
// @desc    Register a new user
// @access  Public
router.post('/register', csrfProtection, userController.register);

// @route   GET /users/login
// @desc    Show login page
// @access  Public (Guest only)
router.get('/login', ensureGuest, csrfProtection, addCsrfToken, userController.showLoginPage);

// @route   POST /users/login
// @desc    Login user
// @access  Public
router.post('/login', csrfProtection, userController.login);

// @route   GET /users/logout
// @desc    Logout user
// @access  Private
router.get('/logout', ensureAuthenticated, userController.logout);

// @route   GET /users/profile
// @desc    Show profile page
// @access  Private
router.get('/profile', ensureAuthenticated, csrfProtection, addCsrfToken, userController.showProfilePage);

// @route   PUT /users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', ensureAuthenticated, csrfProtection, userController.updateProfile);

// @route   GET /users/change-password
// @desc    Show change password page
// @access  Private
router.get('/change-password', ensureAuthenticated, csrfProtection, addCsrfToken, userController.showChangePasswordPage);

// @route   PUT /users/change-password
// @desc    Change password
// @access  Private
router.put('/change-password', ensureAuthenticated, csrfProtection, userController.changePassword);

// @route   GET /users/wishlist
// @desc    Show wishlist page
// @access  Private
router.get('/wishlist', ensureAuthenticated, csrfProtection, addCsrfToken, userController.showWishlist);

// @route   GET /users/wishlist/remove/:productId
// @desc    Remove product from wishlist
// @access  Private
router.get('/wishlist/remove/:productId', ensureAuthenticated, csrfProtection, userController.removeWishlistItem);

// @route   GET /users/orders
// @desc    Show user orders
// @access  Private
router.get('/orders', ensureAuthenticated, userController.showOrders);

// @route   GET /users/addresses
// @desc    Show user addresses
// @access  Private
router.get('/addresses', ensureAuthenticated, csrfProtection, addCsrfToken, userController.showAddresses);

// @route   POST /users/addresses
// @desc    Add new address
// @access  Private
router.post('/addresses', ensureAuthenticated, csrfProtection, userController.addAddress);

// @route   PUT /users/addresses/:id
// @desc    Update address
// @access  Private
router.put('/addresses/:id', ensureAuthenticated, csrfProtection, userController.updateAddress);

// @route   DELETE /users/addresses/:id
// @desc    Delete address
// @access  Private
router.delete('/addresses/:id', ensureAuthenticated, csrfProtection, userController.deleteAddress);

module.exports = router;