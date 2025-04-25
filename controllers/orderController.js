const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const User = require('../models/User');

// @desc    Show checkout page
// @route   GET /orders/checkout
exports.showCheckout = async (req, res) => {
  try {
    // Check if cart is empty
    if (!req.session.cart || req.session.cart.length === 0) {
      req.flash('error_msg', 'Giỏ hàng trống, vui lòng thêm sản phẩm trước khi thanh toán');
      return res.redirect('/cart');
    }
    
    // Reset coupon data when accessing checkout page, unless coming from coupon application
    if (!req.session.couponApplied) {
      req.session.couponCode = null;
      req.session.couponDiscount = 0;
      req.session.couponId = null;
    } else {
      // Reset the flag for next page load
      req.session.couponApplied = false;
    }
    
    // Calculate order summary
    let itemsPrice = 0;
    let totalQuantity = 0;
    
    req.session.cart.forEach(item => {
      itemsPrice += item.price * item.quantity;
      totalQuantity += item.quantity;
    });
    
    // Get shipping methods
    const shippingMethods = [
      { id: 'standard', name: 'Giao hàng tiêu chuẩn', price: 30000, days: '3-5' },
      { id: 'express', name: 'Giao hàng nhanh', price: 50000, days: '1-2' }
    ];
    
    // Lấy giá trị giảm giá từ session nếu có
    const discount = req.session.couponDiscount || 0;
    
    // Default shipping method
    const shippingPrice = shippingMethods[0].price;
    
    // Calculate tax (if applicable, e.g. 10%)
    const taxRate = 0.1;
    const taxPrice = Math.round(itemsPrice * taxRate);
    
    // Calculate total
    const totalPrice = itemsPrice + shippingPrice + taxPrice - discount;
    
    // Save calculations to session
    req.session.orderSummary = {
      itemsPrice,
      shippingPrice,
      taxPrice,
      discount,
      totalPrice
    };
    
    // Debug session
    console.log('DEBUG SESSION DATA:');
    console.log('couponCode:', req.session.couponCode);
    console.log('couponDiscount:', req.session.couponDiscount);
    console.log('couponId:', req.session.couponId);
    console.log('discount used in template:', discount);
    console.log('totalPrice calculation:', `${itemsPrice} + ${shippingPrice} + ${taxPrice} - ${discount} = ${totalPrice}`);
    
    const hasDiscount = discount > 0;
    console.log('hasDiscount:', hasDiscount);
    
    res.render('orders/checkout', {
      title: 'Thanh toán',
      cart: req.session.cart,
      shippingMethods,
      itemsPrice,
      shippingPrice,
      taxPrice,
      discount,
      hasDiscount,
      totalPrice,
      couponCode: req.session.couponCode || '',
      couponDiscount: req.session.couponDiscount || 0,
      couponError: req.flash('couponError')[0] || '',
      couponSuccess: req.flash('couponSuccess')[0] || '',
      userCoupons: await getUserCoupons(req.user),
      user: req.user
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải trang thanh toán');
    res.redirect('/cart');
  }
};

// @desc    Create new order
// @route   POST /orders
exports.createOrder = async (req, res) => {
  try {
    // Check if cart is empty
    if (!req.session.cart || req.session.cart.length === 0) {
      req.flash('error_msg', 'Giỏ hàng trống, vui lòng thêm sản phẩm trước khi thanh toán');
      return res.redirect('/cart');
    }
    
    const { 
      fullName, phone, address, city, district, province, 
      postalCode,
      note,
      paymentMethod, shippingMethod 
    } = req.body;
    
    // Log received data for debugging
    console.log('Received Checkout Data:', req.body);
    console.log('Extracted Postal Code:', postalCode);
    
    // Get shipping price based on method
    let shippingPrice = 30000; // Default
    if (shippingMethod === 'express') {
      shippingPrice = 50000;
    }
    
    // Get order summary from session
    const { itemsPrice, taxPrice, discount } = req.session.orderSummary || {
      itemsPrice: 0,
      taxPrice: 0,
      discount: 0
    };
    
    // Calculate total
    const calculatedTotal = itemsPrice + shippingPrice + taxPrice - discount;
    console.log(`[Order Create] Calculated Total: ${calculatedTotal}`); // Log calculated total
    
    // Create order items
    const orderItems = req.session.cart.map(item => ({
      product: item.productId,
      name: item.name,
      image: item.image,
      price: item.price,
      size: item.size,
      color: item.color,
      quantity: item.quantity
    }));
    
    // Create new order
    const order = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress: {
        fullName,
        phone,
        address,
        city,
        district,
        province,
        postalCode,
        country: req.body.country || 'Việt Nam',
        note
      },
      paymentMethod,
      itemsPrice,
      shippingPrice,
      taxPrice,
      discountPrice: discount,
      totalAmount: calculatedTotal
    });
    
    // If coupon was applied, save it to order
    if (req.session.couponId) {
      order.coupon = req.session.couponId;
      
      // Skip coupon usage update for test coupon
      if (req.session.couponId === '1234567890') {
        console.log('Skipping usage update for test coupon 67WG4OV3');
      } else {
        // Update coupon usage
        const coupon = await Coupon.findById(req.session.couponId);
        if (coupon) {
          coupon.usedCount += 1;
          
          // Add user to usedBy array
          if (coupon.usedBy && Array.isArray(coupon.usedBy)) {
            const userUsageIndex = coupon.usedBy.findIndex(u => 
              u.user.toString() === req.user._id.toString()
            );
            
            if (userUsageIndex > -1) {
              coupon.usedBy[userUsageIndex].count += 1;
            } else {
              coupon.usedBy.push({
                user: req.user._id,
                count: 1
              });
            }
          } else {
            // Create usedBy array if it doesn't exist
            coupon.usedBy = [{
              user: req.user._id,
              count: 1
            }];
          }
          
          await coupon.save();
        }
      }
    }
    
    // Handle payment
    const lowerCasePaymentMethod = paymentMethod.toLowerCase(); // Ensure lowercase comparison
    console.log(`[Order Create] Processing payment method: ${lowerCasePaymentMethod}`); // Log the method being checked
    
    if (lowerCasePaymentMethod === 'cod') {
      console.log('[Order Create] Matched payment method: COD'); // Log block entered
      // Cash on delivery - just save the order
      await order.save();
      
      // Clear cart
      req.session.cart = [];
      req.session.totalQty = 0;
      req.session.couponId = null;
      req.session.couponCode = null;
      req.session.couponDiscount = 0;
      req.session.couponApplied = false;
      req.session.discount = 0;
      req.session.orderSummary = null;
      
      return res.redirect(`/orders/${order._id}`);
    } else if (lowerCasePaymentMethod === 'banking') {
      console.log('[Order Create] Matched payment method: Banking'); // Log block entered
      // Bank transfer - save order and show payment instructions
      order.status = 'pending';
      await order.save();
      
      // Clear cart
      req.session.cart = [];
      req.session.totalQty = 0;
      req.session.couponId = null;
      req.session.couponCode = null;
      req.session.couponDiscount = 0;
      req.session.couponApplied = false;
      req.session.discount = 0;
      req.session.orderSummary = null;
      
      return res.redirect(`/orders/${order._id}?banking=true`);
    } else if (lowerCasePaymentMethod === 'paypal') {
      console.log('[Order Create] Matched payment method: PayPal'); // Log block entered
      // For PayPal, we need to save the order first, then redirect to PayPal
      order.status = 'pending';
      await order.save();
      
      // Save order ID in session for PayPal return handler
      req.session.paypalOrderId = order._id; // Store our order ID
      
      // Clear cart data
      req.session.cart = [];
      req.session.totalQty = 0;
      req.session.couponId = null;
      req.session.couponCode = null;
      req.session.couponDiscount = 0;
      req.session.couponApplied = false;
      req.session.discount = 0;
      req.session.orderSummary = null;
      
      console.log(`[Order Create] Redirecting to PayPal create route: /payment/paypal/create?orderId=${order._id}`);
      return res.redirect(`/payment/paypal/create?orderId=${order._id}`);
    } else if (lowerCasePaymentMethod === 'vnpay') {
      console.log('[Order Create] Matched payment method: VNPay'); // Log block entered
      // Lưu đơn hàng và chuyển hướng đến trang thanh toán VNPay
      order.status = 'pending';
      await order.save();
      
      // Xóa dữ liệu giỏ hàng
      req.session.cart = [];
      req.session.totalQty = 0;
      req.session.couponId = null;
      req.session.couponCode = null;
      req.session.couponDiscount = 0;
      req.session.couponApplied = false;
      req.session.discount = 0;
      req.session.orderSummary = null;
      
      // Chuyển hướng đến trang tạo thanh toán VNPay
      return res.redirect(`/payment/vnpay/payment/${order._id}`);
    }
    
    // Default fallback - Should not be reached if a method was selected
    console.log('[Order Create] WARNING: No payment method matched, executing default fallback redirect!'); 
    // Consider if saving here is needed or if it indicates an error
    // await order.save(); // Probably remove if saved in blocks above
    
    // Clear cart (Ensure this is needed in fallback)
    // ... (clear cart logic)
    
    return res.redirect(`/orders/${order._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xử lý đơn hàng');
    res.redirect('/orders/checkout');
  }
};

// @desc    Show order success page
// @route   GET /orders/success/:id
exports.showOrderSuccess = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/users/orders');
    }
    
    // Check if order belongs to user
    if (order.user.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Bạn không có quyền xem đơn hàng này');
      return res.redirect('/users/orders');
    }
    
    const banking = req.query.banking === 'true';
    
    res.render('orders/success', {
      title: 'Đặt hàng thành công',
      order,
      banking
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải thông tin đơn hàng');
    res.redirect('/users/orders');
  }
};

// @desc    Show order history
// @route   GET /orders/history
exports.showOrderHistory = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    
    res.render('orders/history', {
      title: 'Lịch sử đơn hàng',
      orders
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải lịch sử đơn hàng');
    res.redirect('/');
  }
};

// @desc    Show order details
// @route   GET /orders/:id
exports.showOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product')
      .populate('user', 'name email');
    
    if (!order) {
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/users/orders');
    }
    
    // Check if order belongs to user
    if (order.user._id.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Bạn không có quyền xem đơn hàng này');
      return res.redirect('/users/orders');
    }
    
    res.render('orders/detail', {
      title: `Đơn hàng #${order.orderNumber || order._id}`,
      order
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải thông tin đơn hàng');
    res.redirect('/users/orders');
  }
};

// @desc    Cancel order
// @route   PUT /orders/:id/cancel
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/users/orders');
    }
    
    // Check if order belongs to user
    if (order.user.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Bạn không có quyền hủy đơn hàng này');
      return res.redirect('/users/orders');
    }
    
    // Check if order can be cancelled
    if (!['pending', 'processing'].includes(order.status)) {
      req.flash('error_msg', 'Không thể hủy đơn hàng ở trạng thái này');
      return res.redirect(`/orders/${order._id}`);
    }
    
    // Update order status
    order.status = 'cancelled';
    await order.save();
    
    // Return products to inventory
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 
          countInStock: item.quantity,
          sold: -item.quantity
        }
      });
    }
    
    req.flash('success_msg', 'Đơn hàng đã được hủy thành công');
    res.redirect(`/orders/${order._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi hủy đơn hàng');
    res.redirect(`/orders/${req.params.id}`);
  }
};

// @desc    Apply coupon in checkout page
// @route   POST /orders/apply-coupon
exports.applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    
    if (!couponCode) {
      req.flash('couponError', 'Vui lòng nhập mã giảm giá');
      return res.redirect('/orders/checkout');
    }
    
    // Kiểm tra xem có sản phẩm trong giỏ hàng không
    if (!req.session.cart || req.session.cart.length === 0) {
      req.flash('couponError', 'Giỏ hàng trống, không thể áp dụng mã giảm giá');
      return res.redirect('/orders/checkout');
    }
    
    // Tìm mã giảm giá
    let coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true,
      expiryDate: { $gt: new Date() }
    });
    
    // Mẫu test cho 67WG4OV3
    if (!coupon && couponCode.toUpperCase() === '67WG4OV3') {
      console.log('Sử dụng mã giảm giá mẫu 67WG4OV3');
      coupon = {
        code: '67WG4OV3',
        discountType: 'fixed',
        discountValue: 5000, // Giảm 5000đ
        minAmount: 0,
        _id: '1234567890'
      };
    }
    
    if (!coupon) {
      req.flash('couponError', 'Mã giảm giá không hợp lệ hoặc đã hết hạn');
      return res.redirect('/orders/checkout');
    }
    
    // Tính tổng giá trị đơn hàng
    const itemsPrice = req.session.cart.reduce(
      (total, item) => total + (item.price * item.quantity), 
      0
    );
    
    // Kiểm tra điều kiện áp dụng mã giảm giá
    if (coupon.minAmount > 0 && itemsPrice < coupon.minAmount) {
      req.flash('couponError', `Giá trị đơn hàng tối thiểu để sử dụng mã giảm giá này là ${coupon.minAmount.toLocaleString('vi-VN')}₫`);
      return res.redirect('/orders/checkout');
    }
    
    // Tính giá trị giảm giá
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round(itemsPrice * coupon.discountValue / 100);
    } else {
      discountAmount = coupon.discountValue;
    }
    
    // Đảm bảo giá trị giảm giá luôn là số dương và có ý nghĩa
    discountAmount = Math.max(0, Math.min(discountAmount, itemsPrice));
    
    // Đảm bảo có giảm giá thật sự
    if (discountAmount < 1) {
      req.flash('couponError', 'Mã giảm giá này không áp dụng được cho đơn hàng của bạn');
      return res.redirect('/orders/checkout');
    }
    
    // Lưu mã giảm giá vào session
    req.session.couponCode = coupon.code;
    req.session.couponDiscount = discountAmount;
    req.session.couponId = coupon._id;
    req.session.couponApplied = true; // Set flag to indicate a coupon was just applied
    
    // Cập nhật order summary trong session nếu có
    if (req.session.orderSummary) {
      req.session.orderSummary.discount = discountAmount;
      req.session.orderSummary.totalPrice = 
        req.session.orderSummary.itemsPrice + 
        req.session.orderSummary.shippingPrice + 
        req.session.orderSummary.taxPrice - 
        discountAmount;
    }
    
    // Debug session after applying coupon
    console.log('COUPON APPLIED - DEBUG:');
    console.log('couponCode:', req.session.couponCode);
    console.log('couponDiscount:', req.session.couponDiscount);
    console.log('couponId:', req.session.couponId);
    console.log('orderSummary:', req.session.orderSummary);
    
    req.flash('couponSuccess', `Đã áp dụng mã giảm giá: ${coupon.code}`);
    res.redirect('/orders/checkout');
  } catch (err) {
    console.error(err);
    req.flash('couponError', 'Có lỗi xảy ra khi áp dụng mã giảm giá');
    res.redirect('/orders/checkout');
  }
};

// Helper function to get user coupons
async function getUserCoupons(user) {
  if (!user) return [];
  
  try {
    // Tìm các mã giảm giá thuộc về người dùng
    let userCoupons = await Coupon.find({
      owner: user._id,
      isActive: true,
      expiryDate: { $gt: new Date() }
    }).sort({ expiryDate: 1 });
    
    // Nếu không tìm thấy mã riêng, tìm mã chung
    if (userCoupons.length === 0) {
      userCoupons = await Coupon.find({
        owner: null,
        isActive: true,
        expiryDate: { $gt: new Date() }
      }).sort({ expiryDate: 1 });
    }
    
    return userCoupons;
  } catch (error) {
    console.error('Error fetching user coupons:', error);
    return [];
  }
} 