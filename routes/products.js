const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

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

// @route   GET /products/create
// @desc    Show create product form
// @access  Admin
router.get('/create', ensureAdmin, productController.showCreateForm);

// @route   POST /products
// @desc    Create new product
// @access  Admin
router.post('/', ensureAdmin, productController.createProduct);

// @route   GET /products/:id/edit
// @desc    Show edit product form
// @access  Admin
router.get('/:id/edit', ensureAdmin, productController.showEditForm);

// @route   PUT /products/:id
// @desc    Update product
// @access  Admin
router.put('/:id', ensureAdmin, productController.updateProduct);

// @route   DELETE /products/:id
// @desc    Delete product
// @access  Admin
router.delete('/:id', ensureAdmin, productController.deleteProduct);

module.exports = router; 