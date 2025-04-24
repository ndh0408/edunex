const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryController');
const { ensureAdmin } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const csrf = require('csurf');

// Initialize CSRF protection
const csrfProtection = csrf({ cookie: { httpOnly: true } });

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Apply admin middleware to all routes
router.use(ensureAdmin);

// Add admin layout middleware & CSRF token
router.use((req, res, next) => {
  res.locals.layout = 'layouts/admin';
  res.locals.path = req.originalUrl;
  // Ensure CSRF protection middleware runs before this if needed for token generation
  // This middleware adds the token AFTER csrfProtection has potentially run for the specific route
  if (req.csrfToken) { 
    res.locals.csrfToken = req.csrfToken();
  }
  next();
});

// Apply CSRF Protection globally for POST/PUT/DELETE first
// Note: GET routes needing forms still need individual csrfProtection BEFORE the global middleware above
router.use(csrfProtection); 

// Dashboard
router.get('/', adminController.dashboard);

// Product routes
router.get('/products', adminController.getProducts);
// For GET routes rendering forms, ensure csrfProtection runs before the global middleware adds the token
router.get('/products/create', adminController.showCreateProduct); // Removed individual addCsrfToken
router.post('/products', upload.array('images', 5), adminController.createProduct);
router.get('/products/:id/edit', adminController.showEditProduct); // Removed individual addCsrfToken
router.put('/products/:id', upload.array('images', 5), adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Category routes
router.get('/categories', categoryController.getCategories); // Removed individual addCsrfToken
router.post('/categories/store', upload.single('image'), categoryController.createCategory);
router.post('/categories/update', upload.single('image'), categoryController.updateCategory);
router.post('/categories/delete', categoryController.deleteCategory);
router.get('/categories/delete/:id', categoryController.deleteCategoryByGet);

// Order routes
router.get('/orders', adminController.getOrders); // Removed individual addCsrfToken
router.get('/orders/export', adminController.exportOrders);
router.get('/orders/:id', adminController.getOrder); // Removed individual addCsrfToken
router.put('/orders/:id/status', adminController.updateOrderStatus);
router.post('/orders/:id/status', adminController.updateOrderStatus);
router.put('/orders/:id/payment', adminController.updateOrderPayment);
router.post('/orders/:id/payment', adminController.updateOrderPayment);
router.put('/orders/:id/note', adminController.updateOrderNote);
router.post('/orders/:id/note', adminController.updateOrderNote);
router.get('/orders/:id/invoice', adminController.getOrderInvoice);

// User routes
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser); // Removed individual addCsrfToken
router.put('/users/:id/role', adminController.updateUserRole);

module.exports = router; 