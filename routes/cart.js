const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

// @route   GET /cart
// @desc    Show cart
// @access  Public
router.get('/', cartController.showCart);

// @route   POST /cart/add/:id
// @desc    Add to cart
// @access  Public
router.post('/add/:id', cartController.addToCart);

// @route   PUT /cart/update/:id
// @desc    Update cart item
// @access  Public
router.put('/update/:id', cartController.updateCartItem);

// @route   POST /cart/update/:id
// @desc    Update cart item (alternative for HTML forms)
// @access  Public
router.post('/update/:id', cartController.updateCartItem);

// @route   GET /cart/update/:id
// @desc    Update cart item (simple link version)
// @access  Public
router.get('/update/:id', cartController.updateCartItem);

// @route   DELETE /cart/remove/:productId/:variantId
// @desc    Remove item from cart
// @access  Public
router.delete('/remove/:productId/:variantId', cartController.removeCartItem);

// @route   POST /cart/remove/:productId/:variantId
// @desc    Remove item from cart (alternative for HTML forms)
// @access  Public
router.post('/remove/:productId/:variantId', cartController.removeCartItem);

// @route   DELETE /cart/clear
// @desc    Clear cart
// @access  Public
router.delete('/clear', cartController.clearCart);

// @route   POST /cart/clear
// @desc    Clear cart (alternative for HTML forms)
// @access  Public
router.post('/clear', cartController.clearCart);

// @route   POST /cart/coupon
// @desc    Apply coupon to cart
// @access  Public
router.post('/coupon', cartController.applyCoupon);

// @route   DELETE /cart/coupon
// @desc    Remove coupon from cart
// @access  Public
router.delete('/coupon', cartController.removeCoupon);

// @route   GET /cart/increase/:productId/:variantId
// @desc    Increase product quantity in cart
// @access  Public
router.get('/increase/:productId/:variantId', cartController.increaseQuantity);

// @route   GET /cart/decrease/:productId/:variantId
// @desc    Decrease product quantity in cart
// @access  Public
router.get('/decrease/:productId/:variantId', cartController.decreaseQuantity);

module.exports = router; 