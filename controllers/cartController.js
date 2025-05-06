const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

// @desc    Show cart
// @route   GET /cart
exports.showCart = async (req, res) => {
  try {
    // Sửa để xem cart như một mảng thay vì object với thuộc tính items
    let cart = req.session.cart || [];
    
    // Thêm dữ liệu sản phẩm chi tiết từ database
    const cartItemsWithDetails = [];
    
    for (const item of cart) {
      const product = await Product.findById(item.productId);
      if (product) {
        // Kiểm tra xem product có thuộc tính variants không và item có variantId không
        if (product.variants && Array.isArray(product.variants) && item.variantId) {
          const variant = product.variants.find(v => v._id.toString() === item.variantId);
          if (variant) {
            cartItemsWithDetails.push({
              ...item,
              product: {
                _id: product._id,
                name: product.name,
                slug: product.slug,
                images: product.images,
                description: product.description
              },
              variant: variant
            });
          } else {
            // Nếu không tìm thấy variant phù hợp, thêm sản phẩm với thông tin mặc định
            cartItemsWithDetails.push({
              ...item,
              product: {
                _id: product._id,
                name: product.name,
                slug: product.slug,
                images: product.images,
                description: product.description
              },
              variant: {
                price: product.price || 0,
                discountPrice: product.discountPrice || 0
              }
            });
          }
        } else {
          // Nếu sản phẩm không có variants, thêm thông tin mặc định
          cartItemsWithDetails.push({
            ...item,
            product: {
              _id: product._id,
              name: product.name,
              slug: product.slug,
              images: product.images,
              description: product.description
            },
            variant: {
              price: product.price || 0,
              discountPrice: product.discountPrice || 0
            }
          });
        }
      }
    }

    // Lấy thông tin về mã giảm giá đã áp dụng (nếu có)
    const couponCode = req.session.couponCode || '';
    const couponDiscount = req.session.couponDiscount || 0;
    
    // Lấy thông tin lỗi hoặc thành công từ flash message (nếu có)
    const couponError = req.flash('couponError')[0] || '';
    const couponSuccess = req.flash('couponSuccess')[0] || '';

    // Lấy thông tin người dùng nếu đã đăng nhập
    const user = req.user;
    
    console.log(`Người dùng đăng nhập: ${user ? 'Có - ' + user.name + ' (ID: ' + user._id + ')' : 'Không'}`);
    
    // Khởi tạo biến lưu danh sách mã giảm giá của người dùng
    let userCoupons = [];
    
    // Fetch user's coupons if logged in
    if (user) {
      // Tìm các mã giảm giá thuộc về người dùng này (owner là userId)
      userCoupons = await Coupon.find({
        owner: user._id,
        isActive: true,
        expiryDate: { $gt: new Date() }
      }).sort({ expiryDate: 1 });
      
      console.log(`Tìm thấy ${userCoupons.length} mã giảm giá của người dùng ID ${user._id}`);
      
      // Debug: In ra thông tin của mỗi mã giảm giá tìm thấy
      userCoupons.forEach((coupon, index) => {
        console.log(`Coupon ${index+1}: ${coupon.code} - ${coupon.discountType} - ${coupon.discountValue}`);
      });
      
      // Nếu không tìm thấy coupon nào của user, kiểm tra các coupon chung (không có owner)
      if (userCoupons.length === 0) {
        console.log("Không tìm thấy mã giảm giá riêng của người dùng, tìm mã giảm giá chung...");
        
        userCoupons = await Coupon.find({
          owner: null, // Coupon không có owner
          isActive: true,
          expiryDate: { $gt: new Date() }
        }).sort({ expiryDate: 1 });
        
        console.log(`Tìm thấy ${userCoupons.length} mã giảm giá chung`);
      }
    } else {
      console.log("Không có người dùng đăng nhập, không thể hiển thị mã giảm giá");
    }
    
    // Tính tổng số lượng và tổng giá trị
    const totalQty = cart.reduce((total, item) => total + item.quantity, 0);
    const totalPrice = cart.reduce((total, item) => {
      // Tính giá của mỗi sản phẩm (dùng giá từ variant nếu có) và nhân với số lượng
      const itemPrice = item.price || 0;
      return total + (itemPrice * item.quantity);
    }, 0);
    
    res.render('cart/index', {
      cartItems: cartItemsWithDetails,
      totalQty: totalQty,
      totalPrice: totalPrice,
      couponCode,
      couponDiscount,
      couponError,
      couponSuccess,
      userCoupons, // Truyền danh sách mã giảm giá của người dùng vào view
      user // Truyền thông tin người dùng vào view
    });
  } catch (error) {
    console.error('Error showing cart:', error);
    req.flash('error', 'Có lỗi xảy ra khi hiển thị giỏ hàng');
    res.redirect('/');
  }
};

// @desc    Add to cart
// @route   POST /cart/add/:id
exports.addToCart = async (req, res) => {
  try {
    const productId = req.params.id;
    const { quantity = 1, variantId = '', size = '', color = '' } = req.body;
    
    // Get product
    const product = await Product.findById(productId);
    
    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/products');
    }
    
    // Tìm variant nếu có
    let variant = null;
    let price = product.price;
    let discountPrice = product.discountPrice;
    
    if (variantId && product.variants && Array.isArray(product.variants)) {
      variant = product.variants.find(v => v._id.toString() === variantId);
      if (variant) {
        price = variant.price || product.price;
        discountPrice = variant.discountPrice || product.discountPrice;
      }
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
      item.variantId === variantId
    );
    
    if (existingItemIndex > -1) {
      // Update quantity if product exists
      req.session.cart[existingItemIndex].quantity += parseInt(quantity);
    } else {
      // Add new product to cart
      req.session.cart.push({
        productId,
        variantId: variantId || null,
        name: product.name,
        slug: product.slug,
        price: discountPrice > 0 ? discountPrice : price,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
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
// @route   DELETE /cart/remove/:productId/:variantId
exports.removeCartItem = (req, res) => {
  try {
    const { productId, variantId } = req.params;
    
    // Initialize cart if not exists
    if (!req.session.cart) {
      req.session.cart = [];
      return res.redirect('/cart');
    }
    
    // Find the item in the cart
    const itemIndex = req.session.cart.findIndex(item => 
      item.productId === productId && 
      (item.variantId === variantId || (!item.variantId && variantId === '0'))
    );
    
    if (itemIndex === -1) {
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
    req.session.couponCode = null;
    req.session.couponDiscount = 0;
    req.session.couponApplied = false;
    
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
    const { couponCode } = req.body;
    
    if (!couponCode) {
      req.flash('couponError', 'Vui lòng nhập mã giảm giá');
      return res.redirect('/cart');
    }
    
    // Find coupon
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true,
      expiryDate: { $gt: new Date() }
    });
    
    if (!coupon) {
      req.flash('couponError', 'Mã giảm giá không hợp lệ hoặc đã hết hạn');
      return res.redirect('/cart');
    }
    
    // Calculate total price
    const totalPrice = req.session.cart ? req.session.cart.reduce(
      (total, item) => total + (item.price * item.quantity), 
      0
    ) : 0;
    
    // Kiểm tra điều kiện áp dụng mã giảm giá
    if (coupon.minAmount > 0 && totalPrice < coupon.minAmount) {
      req.flash('couponError', `Giá trị đơn hàng tối thiểu để sử dụng mã giảm giá này là ${coupon.minAmount.toLocaleString('vi-VN')}₫`);
      return res.redirect('/cart');
    }
    
    // Tính giá trị giảm giá
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round(totalPrice * coupon.discountValue / 100);
    } else {
      discountAmount = coupon.discountValue;
    }
    
    // Không để giảm giá vượt quá tổng giá trị đơn hàng
    discountAmount = Math.min(discountAmount, totalPrice);
    
    // Lưu mã giảm giá vào session
    req.session.couponCode = coupon.code;
    req.session.couponDiscount = discountAmount;
    
    req.flash('couponSuccess', `Đã áp dụng mã giảm giá: ${coupon.code}`);
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('couponError', 'Có lỗi xảy ra khi áp dụng mã giảm giá');
    res.redirect('/cart');
  }
};

// @desc    Remove coupon from cart
// @route   DELETE /cart/coupon
exports.removeCoupon = (req, res) => {
  try {
    // Remove coupon
    req.session.couponCode = null;
    req.session.couponDiscount = 0;
    
    req.flash('success_msg', 'Đã xóa mã giảm giá');
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xóa mã giảm giá');
    res.redirect('/cart');
  }
};

// @desc    Increase product quantity in cart
// @route   GET /cart/increase/:productId/:variantId
exports.increaseQuantity = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    
    // Initialize cart if not exists
    if (!req.session.cart) {
      req.session.cart = [];
      return res.redirect('/cart');
    }
    
    // Find the item in the cart
    const itemIndex = req.session.cart.findIndex(item => 
      item.productId === productId && 
      (item.variantId === variantId || (!item.variantId && variantId === '0'))
    );
    
    if (itemIndex === -1) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm trong giỏ hàng');
      return res.redirect('/cart');
    }
    
    // Check if product is in stock before increasing
    const product = await Product.findById(productId);
    if (!product || product.countInStock <= req.session.cart[itemIndex].quantity) {
      req.flash('error_msg', 'Sản phẩm đã hết hàng hoặc đã đạt số lượng tối đa');
      return res.redirect('/cart');
    }
    
    // Increase quantity
    req.session.cart[itemIndex].quantity += 1;
    
    // Calculate total quantity
    req.session.totalQty = req.session.cart.reduce((total, item) => total + item.quantity, 0);
    
    return res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật giỏ hàng');
    return res.redirect('/cart');
  }
};

// @desc    Decrease product quantity in cart
// @route   GET /cart/decrease/:productId/:variantId
exports.decreaseQuantity = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    
    // Initialize cart if not exists
    if (!req.session.cart) {
      req.session.cart = [];
      return res.redirect('/cart');
    }
    
    // Find the item in the cart
    const itemIndex = req.session.cart.findIndex(item => 
      item.productId === productId && 
      (item.variantId === variantId || (!item.variantId && variantId === '0'))
    );
    
    if (itemIndex === -1) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm trong giỏ hàng');
      return res.redirect('/cart');
    }
    
    // If quantity is 1, remove the item
    if (req.session.cart[itemIndex].quantity <= 1) {
      req.session.cart.splice(itemIndex, 1);
    } else {
      // Decrease quantity
      req.session.cart[itemIndex].quantity -= 1;
    }
    
    // Calculate total quantity
    req.session.totalQty = req.session.cart.reduce((total, item) => total + item.quantity, 0);
    
    return res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật giỏ hàng');
    return res.redirect('/cart');
  }
}; 
