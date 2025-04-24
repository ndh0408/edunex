const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const multer = require('multer'); // Import multer
const path = require('path');
const fs = require('fs');
const csrf = require('csurf'); // Import csurf

// Initialize CSRF protection
const csrfProtection = csrf();

// --- Multer Configuration for Category Images ---
const categoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'categories');
    // Create directory if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true }); 
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Create unique filename: fieldname-timestamp.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (optional: accept only images)
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ cho phép upload file hình ảnh!'), false);
  }
};

const uploadCategoryImage = multer({ 
  storage: categoryStorage, 
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Limit file size to 5MB (optional)
});
// --------------------------------------------------

// --- Multer Configuration for Product Images ---
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'products');
    fs.mkdirSync(uploadPath, { recursive: true }); 
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Re-use the image file filter
const uploadProductImages = multer({ 
  storage: productStorage, 
  fileFilter: imageFileFilter, // Use the same filter as categories
  limits: { fileSize: 2 * 1024 * 1024 } // Limit file size to 2MB per image (example)
});
// --------------------------------------------

// === DEFINE CUSTOM MIDDLEWARE FUNCTIONS BEFORE ROUTES ===

// --- Custom Middleware for Category POST ---
const handleCategoryUploadAndCSRF = (req, res, next) => {
  uploadCategoryImage.single('image')(req, res, (multerErr) => {
    if (multerErr) {
      console.error("Multer error during category creation:", multerErr);
      req.flash('error_msg', 'Lỗi upload hình ảnh: ' + multerErr.message);
      return res.redirect('/admin/categories'); 
    }
    csrfProtection(req, res, next);
  });
};
// -----------------------------------------

// --- Custom Middleware for Product POST ---
const handleProductUploadAndCSRF = (req, res, next) => {
  uploadProductImages.array('images', 5)(req, res, (multerErr) => {
    if (multerErr) {
      console.error("Multer error during product creation:", multerErr);
      req.flash('error_msg', 'Lỗi upload hình ảnh sản phẩm: ' + multerErr.message);
      const Category = require('../models/Category');
      Category.find().then(categories => {
          res.locals.layout = 'admin/layout'; 
          res.render('admin/products/create', { 
              title: 'Thêm sản phẩm mới',
              categories: categories,
              error_msg: req.flash('error_msg'),
              product: req.body 
          });
      }).catch(fetchError => {
          req.flash('error_msg', 'Lỗi tải trang thêm sản phẩm.');
          res.redirect('/admin/products');
      });
      return; 
    }
    csrfProtection(req, res, next);
  });
};
// -----------------------------------------

// --- Custom Middleware for Product PUT ---
const handleProductUpdateAndCSRF = (req, res, next) => {
  // Use .array('images', 5) to handle multiple files for the 'images' field
  uploadProductImages.array('images', 5)(req, res, (multerErr) => {
    if (multerErr) {
      // Handle multer errors specifically for update if needed
      console.error("Multer error during product update:", multerErr);
      req.flash('error_msg', 'Lỗi upload hình ảnh khi cập nhật: ' + multerErr.message);
      // Redirect back to product list (or potentially edit page if possible)
      return res.redirect('/admin/products'); 
    }
    // If multer is successful, proceed to CSRF protection
    csrfProtection(req, res, next);
  });
};
// -----------------------------------------

// === ROUTE DEFINITIONS ===

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
router.post('/users', csrfProtection, adminController.createUser);
router.put('/users/:id', csrfProtection, adminController.updateUser);
router.delete('/users/:id', csrfProtection, adminController.deleteUser);

// Product management
router.get('/products', adminController.getProducts);
router.get('/products/create', csrfProtection, adminController.getCreateProductPage);
router.post('/products', handleProductUploadAndCSRF, adminController.createProduct);
router.get('/products/:id/edit', csrfProtection, adminController.getEditProductPage);
router.put('/products/:id', handleProductUpdateAndCSRF, adminController.updateProduct);
router.delete('/products/:id', csrfProtection, adminController.deleteProduct);

// Order management
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderDetails);
router.put('/orders/:id', csrfProtection, adminController.updateOrderStatus);

// Category management
router.get('/categories', csrfProtection, adminController.getCategories);
router.post('/categories', handleCategoryUploadAndCSRF, adminController.createCategory);
router.put('/categories/:id', csrfProtection, adminController.updateCategory);
router.delete('/categories/:id', csrfProtection, adminController.deleteCategory);

// Statistics and reports
router.get('/statistics', adminController.getStatistics);
router.get('/reports', adminController.getReports);

// Coupon Management
router.get('/coupons', adminController.getCoupons);
router.post('/coupons', csrfProtection, adminController.createCoupon);
router.get('/coupons/:id/json', adminController.getCouponJSON);
router.put('/coupons/:id', csrfProtection, adminController.updateCoupon);
router.delete('/coupons/:id', csrfProtection, adminController.deleteCoupon);

module.exports = router; 