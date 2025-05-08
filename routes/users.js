const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { ensureAuthenticated, ensureGuest } = require('../middlewares/auth');
const csrf = require('csurf');
const User = require('../models/User');

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

// @route   GET /users/forgot-password
// @desc    Show forgot password page
// @access  Public
router.get('/forgot-password', csrfProtection, addCsrfToken, userController.showForgotPasswordPage);

// @route   POST /users/forgot-password
// @desc    Process forgot password request
// @access  Public
router.post('/forgot-password', csrfProtection, userController.forgotPassword);

// @route   GET /users/reset-password/:token
// @desc    Show reset password page
// @access  Public
router.get('/reset-password/:token', csrfProtection, addCsrfToken, userController.showResetPasswordPage);

// @route   POST /users/reset-password/:token
// @desc    Process reset password
// @access  Public
router.post('/reset-password/:token', csrfProtection, userController.resetPassword);

// @route   GET /users/verify/:token
// @desc    Verify user email
// @access  Public
router.get('/verify/:token', userController.verifyEmail);

// @route   GET /users/resend-verification
// @desc    Show resend verification email page
// @access  Public
router.get('/resend-verification', csrfProtection, addCsrfToken, userController.showResendVerificationPage);

// @route   POST /users/resend-verification
// @desc    Resend verification email
// @access  Public
router.post('/resend-verification', csrfProtection, userController.resendVerification);

// TEMPORARY: Diagnostic endpoint to fix wishlist duplicates
router.get('/fix-wishlist', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Check for duplicates
    const wishlistIds = user.wishlist.map(id => id.toString());
    const uniqueIds = [...new Set(wishlistIds)];
    const duplicatesCount = wishlistIds.length - uniqueIds.length;
    
    if (duplicatesCount > 0) {
      // Fix duplicates
      user.wishlist = uniqueIds;
      await user.save();
      
      return res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Wishlist Fixed</h1>
          <p>Found and removed ${duplicatesCount} duplicate items from your wishlist.</p>
          <p>Original count: ${wishlistIds.length}</p>
          <p>New count: ${uniqueIds.length}</p>
          <a href="/users/wishlist" style="display: inline-block; background: #4267B2; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Go to My Wishlist</a>
        </div>
      `);
    } else {
      return res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Wishlist Check</h1>
          <p>No duplicates found in your wishlist.</p>
          <p>Current wishlist count: ${wishlistIds.length}</p>
          <a href="/users/wishlist" style="display: inline-block; background: #4267B2; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Go to My Wishlist</a>
        </div>
      `);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;