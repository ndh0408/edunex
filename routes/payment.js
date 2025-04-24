const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { ensureAuthenticated } = require('../middlewares/auth');

// PayPal Routes
router.get('/paypal/create', ensureAuthenticated, paymentController.createPayPalPayment);
router.get('/paypal/capture', ensureAuthenticated, paymentController.capturePayPalPayment);
router.get('/paypal/cancel', ensureAuthenticated, paymentController.cancelPayPalPayment);

// VNPay Routes
router.get('/vnpay/payment/:id', ensureAuthenticated, paymentController.createVNPayPayment);
router.get('/vnpay/return', paymentController.processVNPayPayment);

// Manual Payment Update
router.get('/manual-update/:id', ensureAuthenticated, paymentController.manualPaymentUpdate);

module.exports = router; 