const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const userController = require('../controllers/userController');
const cartController = require('../controllers/cartController');
const chatbotController = require('../controllers/chatbotController');
const { apiAuth } = require('../middlewares/auth');

// Product routes
router.get('/products', productController.getProducts);
router.get('/products/search', productController.searchProducts);
router.get('/products/:id', productController.getProductById);
router.post('/products/:id/reviews', productController.addReview);

// User routes
router.post('/users/wishlist/:productId', apiAuth, userController.addToWishlist);
router.delete('/users/wishlist/:productId', apiAuth, userController.removeFromWishlist);

// Cart routes
router.post('/cart/add', addToCartApi);

// Chatbot route
router.post('/chatbot', chatbotController.processMessage);

// API Cart add function
function addToCartApi(req, res) {
  try {
    const { productId, quantity = 1, size = '', color = '' } = req.body;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    
    // Get product from database
    const Product = require('../models/Product');
    Product.findById(productId)
      .then(product => {
        if (!product) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy sản phẩm'
          });
        }
        
        // Check if product is in stock
        if (product.countInStock < quantity || product.status === 'outOfStock') {
          return res.status(400).json({
            success: false,
            message: 'Sản phẩm đã hết hàng'
          });
        }
        
        // Initialize cart if not exists
        if (!req.session.cart) {
          req.session.cart = [];
        }
        
        // Check if product already in cart with same options
        const existingItemIndex = req.session.cart.findIndex(item => 
          item.productId.toString() === productId.toString() && 
          item.size === size && 
          item.color === color
        );
        
        if (existingItemIndex > -1) {
          // Update quantity if product exists
          req.session.cart[existingItemIndex].quantity += parseInt(quantity);
        } else {
          // Add new product to cart
          req.session.cart.push({
            productId: productId.toString(),
            name: product.name,
            slug: product.slug,
            price: product.discountPrice > 0 ? product.discountPrice : product.price,
            image: product.images && product.images.length > 0 ? product.images[0] : '',
            size,
            color,
            quantity: parseInt(quantity),
            stock: product.countInStock
          });
        }
        
        // Calculate total quantity
        req.session.totalQty = req.session.cart.reduce((total, item) => total + item.quantity, 0);
        
        return res.status(200).json({
          success: true,
          message: 'Đã thêm sản phẩm vào giỏ hàng',
          cartCount: req.session.totalQty
        });
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({
          success: false,
          message: 'Có lỗi xảy ra khi thêm sản phẩm vào giỏ hàng'
        });
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi thêm sản phẩm vào giỏ hàng'
    });
  }
}

module.exports = router; 