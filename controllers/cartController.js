const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

// @desc    Show cart
// @route   GET /cart
exports.showCart = async (req, res) => {
  try {
    let cart = req.session.cart || [];
    let totalPrice = 0;
    let totalQuantity = 0;
    let coupon = null;
    let discount = 0;
    
    // Calculate totals
    cart.forEach(item => {
      totalPrice += item.price * item.quantity;
      totalQuantity += item.quantity;
    });
    
    // Check if coupon is applied
    if (req.session.couponId) {
      coupon = await Coupon.findById(req.session.couponId);
      
      if (coupon) {
        // Validate coupon again
        const userId = req.user ? req.user._id : null;
        const validationResult = coupon.isValid(userId, totalPrice);
        
        if (validationResult.valid) {
          discount = coupon.calculateDiscount(totalPrice);
          
          // Ensure discount doesn't exceed total price
          if (discount > totalPrice) {
            discount = totalPrice;
          }
        } else {
          // Remove invalid coupon
          req.session.couponId = null;
          req.flash('error_msg', validationResult.message);
        }
      } else {
        // Coupon no longer exists
        req.session.couponId = null;
      }
    }
    
    // Update session
    req.session.totalPrice = totalPrice;
    req.session.discount = discount;
    req.session.finalPrice = totalPrice - discount;
    req.session.totalQty = totalQuantity;
    
    res.render('cart/index', {
      title: 'Giỏ hàng',
      cart: {
        items: cart,
        total: totalPrice,
        discount: discount,
        totalWithShipping: totalPrice - discount,
        shippingFee: 0
      },
      totalPrice,
      discount,
      finalPrice: totalPrice - discount,
      coupon,
      couponCode: req.session.couponCode || '',
      couponError: req.flash('coupon_error') || null,
      couponSuccess: req.flash('coupon_success') || null
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải giỏ hàng');
    res.redirect('/');
  }
};

// @desc    Add to cart
// @route   POST /cart/add/:id
exports.addToCart = async (req, res) => {
  try {
    const productId = req.params.id;
    const { quantity = 1, size = '', color = '' } = req.body;
    
    // Get product
    const product = await Product.findById(productId);
    
    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/products');
    }
    
    // Check if product is in stock
    if (product.countInStock < quantity || product.status === 'outOfStock') {
      req.flash('error_msg', 'Sản phẩm đã hết hàng');
      return res.redirect(`/products/${product.slug}`);
    }
    
    // Initialize cart if not exists
    if (!req.session.cart) {
      req.session.cart = [];
    }
    
    // Check if product already in cart
    const existingItemIndex = req.session.cart.findIndex(item => 
      item.productId === productId && 
      item.size === size && 
      item.color === color
    );
    
    if (existingItemIndex > -1) {
      // Update quantity if product exists
      req.session.cart[existingItemIndex].quantity += parseInt(quantity);
    } else {
      // Add new product to cart
      req.session.cart.push({
        productId,
        name: product.name,
        slug: product.slug,
        price: product.discountPrice > 0 ? product.discountPrice : product.price,
        image: product.images[0],
        size,
        color,
        quantity: parseInt(quantity),
        stock: product.countInStock
      });
    }
    
    // Calculate total quantity
    req.session.totalQty = req.session.cart.reduce((total, item) => total + item.quantity, 0);
    
    req.flash('success_msg', 'Đã thêm sản phẩm vào giỏ hàng');
    
    // Redirect to cart or continue shopping
    if (req.body.checkout) {
      return res.redirect('/cart');
    }
    
    return res.redirect(`/products/${product.slug}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi thêm sản phẩm vào giỏ hàng');
    res.redirect('/products');
  }
};

// @desc    Update cart item
// @route   PUT /cart/update/:id
// @route   POST /cart/update/:id
// @route   GET /cart/update/:id
exports.updateCartItem = async (req, res) => {
  try {
    const itemIndex = req.params.id;
    // Lấy quantity từ query params (GET) hoặc body (POST)
    const quantity = req.method === 'GET' ? req.query.quantity : req.body.quantity;
    
    // Validate
    if (!req.session.cart || !req.session.cart[itemIndex]) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm trong giỏ hàng');
      return res.redirect('/cart');
    }
    
    // Update quantity
    req.session.cart[itemIndex].quantity = parseInt(quantity);
    
    // Calculate total quantity
    req.session.totalQty = req.session.cart.reduce((total, item) => total + item.quantity, 0);
    
    req.flash('success_msg', 'Đã cập nhật giỏ hàng');
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật giỏ hàng');
    res.redirect('/cart');
  }
};

// @desc    Remove item from cart
// @route   DELETE /cart/remove/:id
exports.removeCartItem = (req, res) => {
  try {
    const itemIndex = req.params.id;
    
    // Validate
    if (!req.session.cart || !req.session.cart[itemIndex]) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm trong giỏ hàng');
      return res.redirect('/cart');
    }
    
    // Remove item
    req.session.cart.splice(itemIndex, 1);
    
    // Calculate total quantity
    req.session.totalQty = req.session.cart.reduce((total, item) => total + item.quantity, 0);
    
    req.flash('success_msg', 'Đã xóa sản phẩm khỏi giỏ hàng');
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xóa sản phẩm khỏi giỏ hàng');
    res.redirect('/cart');
  }
};

// @desc    Clear cart
// @route   DELETE /cart/clear
exports.clearCart = (req, res) => {
  try {
    // Reset cart
    req.session.cart = [];
    req.session.totalQty = 0;
    req.session.couponId = null;
    req.session.discount = 0;
    
    req.flash('success_msg', 'Đã xóa tất cả sản phẩm khỏi giỏ hàng');
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xóa giỏ hàng');
    res.redirect('/cart');
  }
};

// @desc    Apply coupon to cart
// @route   POST /cart/coupon
exports.applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      req.flash('error_msg', 'Vui lòng nhập mã giảm giá');
      return res.redirect('/cart');
    }
    
    // Find coupon
    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });
    
    if (!coupon) {
      req.flash('error_msg', 'Mã giảm giá không hợp lệ hoặc đã hết hạn');
      return res.redirect('/cart');
    }
    
    // Calculate total price
    const totalPrice = req.session.cart.reduce(
      (total, item) => total + (item.price * item.quantity), 
      0
    );
    
    // Validate coupon
    const userId = req.user ? req.user._id : null;
    const validationResult = coupon.isValid(userId, totalPrice);
    
    if (!validationResult.valid) {
      req.flash('error_msg', validationResult.message);
      return res.redirect('/cart');
    }
    
    // Apply coupon
    req.session.couponId = coupon._id;
    req.flash('success_msg', 'Đã áp dụng mã giảm giá');
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi áp dụng mã giảm giá');
    res.redirect('/cart');
  }
};

// @desc    Remove coupon from cart
// @route   DELETE /cart/coupon
exports.removeCoupon = (req, res) => {
  try {
    // Remove coupon
    req.session.couponId = null;
    req.session.discount = 0;
    
    req.flash('success_msg', 'Đã xóa mã giảm giá');
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xóa mã giảm giá');
    res.redirect('/cart');
  }
}; 