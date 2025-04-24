const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { ensureAuthenticated } = require('../middlewares/auth');

// @route   GET /products
// @desc    Show all products
// @access  Public
router.get('/', productController.getProducts);

// @route   GET /products/:slug
// @desc    Show single product
// @access  Public
router.get('/:slug', productController.getProduct);

// @route   POST /products/:id/reviews
// @desc    Create product review
// @access  Private
router.post('/:id/reviews', ensureAuthenticated, productController.createReview);

module.exports = router; 