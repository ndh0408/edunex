const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Redirect từ /admin sang /admin/dashboard
router.get('/', (req, res) => {
  res.redirect('/admin/dashboard'); 
});

// Admin dashboard
router.get('/dashboard', adminController.getDashboard);

// User management
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.get('/users/:id/json', adminController.getUserJSON);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Product management
router.get('/products', adminController.getProducts);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Order management
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderDetails);
router.put('/orders/:id', adminController.updateOrderStatus);

// Category management
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Statistics and reports
router.get('/statistics', adminController.getStatistics);
router.get('/reports', adminController.getReports);

// Coupon Management (New)
router.get('/coupons', adminController.getCoupons);
router.post('/coupons', adminController.createCoupon); // For adding new coupon
router.get('/coupons/:id/json', adminController.getCouponJSON); // Get data for edit modal
router.put('/coupons/:id', adminController.updateCoupon); // Update existing coupon
router.delete('/coupons/:id', adminController.deleteCoupon); // Delete coupon

module.exports = router; 