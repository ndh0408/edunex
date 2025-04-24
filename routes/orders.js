const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { ensureAuthenticated } = require('../middlewares/auth');

// @route   GET /checkout
// @desc    Show checkout page
// @access  Private
router.get('/checkout', ensureAuthenticated, orderController.showCheckout);

// @route   POST /orders
// @desc    Create new order
// @access  Private
router.post('/', ensureAuthenticated, orderController.createOrder);

// @route   GET /orders/success/:id
// @desc    Show order success page
// @access  Private
router.get('/success/:id', ensureAuthenticated, orderController.showOrderSuccess);

// This route is now moved to /users/orders
// @route   GET /orders/history
// @desc    Show order history
// @access  Private
// router.get('/history', ensureAuthenticated, orderController.showOrderHistory);

// @route   GET /orders/:id
// @desc    Show order details
// @access  Private
router.get('/:id', ensureAuthenticated, orderController.showOrderDetails);

// @route   PUT /orders/:id/cancel
// @desc    Cancel order
// @access  Private
router.put('/:id/cancel', ensureAuthenticated, orderController.cancelOrder);

// @route   POST /orders/:id/cancel
// @desc    Cancel order (for forms without method override)
// @access  Private
router.post('/:id/cancel', ensureAuthenticated, orderController.cancelOrder);

module.exports = router; 