const User = require('../models/User');
const Cart = require('../models/Cart');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../utils/emailService');

// @desc    Show register page
// @route   GET /users/register
exports.showRegisterPage = (req, res) => {
  res.render('users/register', {
    title: 'Đăng ký tài khoản'
  });
};

// @desc    Show login page
// @route   GET /users/login
exports.showLoginPage = (req, res) => {
  res.render('users/login', {
    title: 'Đăng nhập'
  });
};

// @desc    Register a new user
// @route   POST /users/register
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, confirm_password } = req.body;
    
    console.log('Register attempt:', { name, email, phone });
    
    // Validation
    const errors = [];
    
    if (!name || !email || !phone || !password || !confirm_password) {
      errors.push({ msg: 'Vui lòng điền đầy đủ thông tin' });
    }
    
    if (password !== confirm_password) {
      errors.push({ msg: 'Mật khẩu không khớp' });
    }
    
    if (password.length < 6) {
      errors.push({ msg: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }
    
    if (errors.length > 0) {
      console.log('Registration validation errors:', errors);
      return res.render('users/register', {
        title: 'Đăng ký tài khoản',
        errors,
        name,
        email,
        phone
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      errors.push({ msg: 'Email đã được sử dụng' });
      return res.render('users/register', {
        title: 'Đăng ký tài khoản',
        errors,
        name,
        email,
        phone
      });
    }
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');
    
    // Create new user
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      isVerified: false,
      verificationToken,
      verificationExpire: Date.now() + 86400000 // 24 hours
    });
    
    // Save user
    await newUser.save();
    console.log('User registered successfully:', newUser._id);
    
    // Create empty cart for user
    await new Cart({ user: newUser._id, items: [] }).save();
    
    // Send verification email
    try {
      await sendVerificationEmail(newUser.email, verificationToken, newUser.name);
      req.flash('success_msg', 'Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác thực tài khoản.');
    } catch (err) {
      console.error('Error sending verification email:', err);
      req.flash('success_msg', 'Đăng ký thành công! Có lỗi khi gửi email xác thực, vui lòng liên hệ hỗ trợ.');
    }
    
    res.redirect('/users/login');
  } catch (err) {
    console.error('Registration error:', err);
    req.flash('error_msg', 'Có lỗi xảy ra khi đăng ký: ' + err.message);
    res.redirect('/users/register');
  }
};

// @desc    Login user
// @route   POST /users/login
exports.login = (req, res, next) => {
  try {
    console.log('Login attempt for:', req.body.email);
    
    // Kiểm tra CSRF token trước khi xác thực
    if (!req.body._csrf) {
      console.log('CSRF token missing');
      req.flash('error', 'Phiên làm việc không hợp lệ. Vui lòng thử lại.');
      return res.redirect('/users/login');
    }
    
    // Sử dụng custom callback thay vì options object
    passport.authenticate('local', function(err, user, info) {
      console.log('Passport authenticate result:', { error: err ? true : false, userFound: user ? true : false });
      
      if (err) {
        console.error('Login error:', err);
        req.flash('error', 'Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại sau.');
        return res.redirect('/users/login');
      }
      
      if (!user) {
        // Thông báo lỗi từ passport strategy
        console.log('Auth failed:', info.message);
        req.flash('error', info.message || 'Email hoặc mật khẩu không chính xác.');
        return res.redirect('/users/login');
      }
      
      // Check if user is verified
      console.log('User verification status:', user.isVerified);
      if (!user.isVerified) {
        req.flash('error', 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn hoặc yêu cầu gửi lại email xác thực.');
        return res.redirect('/users/login');
      }
      
      // Đăng nhập thành công
      req.logIn(user, function(err) {
        if (err) {
          console.error('Login session error:', err);
          req.flash('error', 'Có lỗi xảy ra khi tạo phiên đăng nhập.');
          return res.redirect('/users/login');
        }
        
        console.log('User logged in successfully:', user._id, user.email);
        console.log('Session after login:', req.session);
        
        // Lưu thông tin ghi nhớ đăng nhập nếu có
        if (req.body.remember) {
          // Kéo dài thời gian sống của cookie session
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 ngày
        } else {
          // Sử dụng cookie session mặc định
          req.session.cookie.expires = false;
        }
        
        // Lưu session ngay lập tức
        req.session.save(function(err) {
          if (err) {
            console.error('Error saving session:', err);
          }
          return res.redirect('/');
        });
      });
    })(req, res, next);
  } catch (error) {
    console.error('Unexpected login error:', error);
    req.flash('error', 'Lỗi đăng nhập không xác định. Vui lòng thử lại.');
    return res.redirect('/users/login');
  }
};

// @desc    Logout user
// @route   GET /users/logout
exports.logout = (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.flash('success_msg', 'Đăng xuất thành công');
    res.redirect('/users/login');
  });
};

// @desc    Show profile page
// @route   GET /users/profile
exports.showProfilePage = async (req, res) => {
  try {
    res.render('users/profile', {
      title: 'Thông tin tài khoản',
      user: req.user
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Không thể tải thông tin tài khoản');
    res.redirect('/');
  }
};

// @desc    Update user profile
// @route   PUT /users/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, currentPassword, newPassword, confirmPassword } = req.body;
    
    // Create update object for basic info
    const updateData = {
      name,
      phone
    };
    
    // Check if user is trying to change password
    if (currentPassword && newPassword && confirmPassword) {
      // Validate passwords
      if (newPassword !== confirmPassword) {
        req.flash('error_msg', 'Mật khẩu mới không khớp');
        return res.redirect('/users/profile');
      }
      
      if (newPassword.length < 6) {
        req.flash('error_msg', 'Mật khẩu mới phải có ít nhất 6 ký tự');
        return res.redirect('/users/profile');
      }
      
      // Verify current password
      const user = await User.findById(req.user.id);
      const isMatch = await user.matchPassword(currentPassword);
      
      if (!isMatch) {
        req.flash('error_msg', 'Mật khẩu hiện tại không chính xác');
        return res.redirect('/users/profile');
      }
      
      // Update password separately because it needs hashing (done in the pre-save hook)
      user.password = newPassword;
      await user.save();
      
      // Update other fields
      await User.findByIdAndUpdate(req.user.id, updateData);
      
      req.flash('success_msg', 'Cập nhật thông tin và mật khẩu thành công');
      return res.redirect('/users/profile');
    }
    
    // Just update profile without password change
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    );
    
    req.flash('success_msg', 'Cập nhật thông tin thành công');
    res.redirect('/users/profile');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật thông tin');
    res.redirect('/users/profile');
  }
};

// @desc    Show change password page
// @route   GET /users/change-password
exports.showChangePasswordPage = (req, res) => {
  res.render('users/change-password', {
    title: 'Đổi mật khẩu'
  });
};

// @desc    Change password
// @route   PUT /users/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Validation
    if (newPassword !== confirmPassword) {
      req.flash('error_msg', 'Mật khẩu mới không khớp');
      return res.redirect('/users/change-password');
    }
    
    if (newPassword.length < 6) {
      req.flash('error_msg', 'Mật khẩu mới phải có ít nhất 6 ký tự');
      return res.redirect('/users/change-password');
    }
    
    // Check current password
    const user = await User.findById(req.user.id);
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
      req.flash('error_msg', 'Mật khẩu hiện tại không chính xác');
      return res.redirect('/users/change-password');
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    req.flash('success_msg', 'Đổi mật khẩu thành công');
    res.redirect('/users/profile');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi đổi mật khẩu');
    res.redirect('/users/change-password');
  }
};

// @desc    Show wishlist page
// @route   GET /users/wishlist
exports.showWishlist = async (req, res) => {
  try {
    // Fetch user with populated wishlist
    const user = await User.findById(req.user.id).populate('wishlist');
    
    // Create an array to hold only unique products
    const uniqueWishlist = [];
    const seenIds = new Set();
    
    // Filter out duplicates
    if (user.wishlist && user.wishlist.length > 0) {
      // Only keep the first occurrence of each product
      user.wishlist.forEach(product => {
        if (product && product._id) {
          const productId = product._id.toString();
          if (!seenIds.has(productId)) {
            seenIds.add(productId);
            uniqueWishlist.push(product);
          }
        }
      });
      
      // If we found duplicates, update the user's wishlist
      if (uniqueWishlist.length !== user.wishlist.length) {
        console.log(`Removing ${user.wishlist.length - uniqueWishlist.length} duplicate items from user ${user.email}'s wishlist`);
        // Only store the unique IDs
        user.wishlist = uniqueWishlist.map(product => product._id);
        await user.save();
      }
    }
    
    res.render('users/wishlist', {
      title: 'Sản phẩm yêu thích',
      wishlist: uniqueWishlist
    });
  } catch (err) {
    console.error('Error displaying wishlist:', err);
    req.flash('error_msg', 'Không thể tải danh sách yêu thích');
    res.redirect('/');
  }
};

// @desc    Add product to wishlist (API)
// @route   POST /api/users/wishlist/:productId
exports.addToWishlist = async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'ID sản phẩm không hợp lệ'
      });
    }
    
    // Check if product exists
    const Product = require('../models/Product');
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }
    
    // Get user
    const user = await User.findById(req.user.id);
    
    // Convert all wishlist IDs to strings for accurate comparison
    const wishlistIds = user.wishlist.map(id => id.toString());
    
    // Check if product is already in wishlist
    if (wishlistIds.includes(productId)) {
      return res.status(200).json({
        success: true,
        message: 'Sản phẩm đã có trong danh sách yêu thích',
        wishlistCount: wishlistIds.length
      });
    }
    
    // Add to wishlist
    user.wishlist.push(productId);
    await user.save();
    
    console.log(`User ${user.email} added product ${productId} to wishlist. New count: ${user.wishlist.length}`);
    
    return res.status(200).json({
      success: true,
      message: 'Đã thêm vào danh sách yêu thích',
      wishlistCount: user.wishlist.length
    });
  } catch (err) {
    console.error('Error adding to wishlist:', err);
    return res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi thêm vào yêu thích'
    });
  }
};

// @desc    Remove product from wishlist (API)
// @route   DELETE /api/users/wishlist/:productId
exports.removeFromWishlist = async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'ID sản phẩm không hợp lệ'
      });
    }
    
    // Get user
    const user = await User.findById(req.user.id);
    
    // Convert wishlist to array of strings for easier comparison
    const originalLength = user.wishlist.length;
    
    // Remove all instances of this product (in case of duplicates)
    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    
    // Only save if something was removed
    if (user.wishlist.length !== originalLength) {
      await user.save();
    }
    
    console.log(`User ${user.email} removed product ${productId} from wishlist. Removed ${originalLength - user.wishlist.length} instance(s).`);
    
    return res.status(200).json({
      success: true,
      message: 'Đã xóa khỏi danh sách yêu thích',
      wishlistCount: user.wishlist.length
    });
  } catch (err) {
    console.error('Error removing from wishlist:', err);
    return res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi xóa khỏi yêu thích'
    });
  }
};

// @desc    Remove product from wishlist (Direct link)
// @route   GET /users/wishlist/remove/:productId
exports.removeWishlistItem = async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      req.flash('error_msg', 'ID sản phẩm không hợp lệ');
      return res.redirect('/users/wishlist');
    }
    
    // Get user
    const user = await User.findById(req.user.id);
    
    // Remove from wishlist (all instances in case of duplicates)
    const originalLength = user.wishlist.length;
    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    
    // Only save if something was removed
    if (user.wishlist.length !== originalLength) {
      await user.save();
      console.log(`User ${user.email} removed product ${productId} from wishlist using direct link. Removed ${originalLength - user.wishlist.length} instance(s).`);
    }
    
    req.flash('success_msg', 'Đã xóa sản phẩm khỏi danh sách yêu thích');
    res.redirect('/users/wishlist');
  } catch (err) {
    console.error('Error removing from wishlist:', err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xóa sản phẩm');
    res.redirect('/users/wishlist');
  }
};

// @desc    Show user orders page
// @route   GET /users/orders
exports.showOrders = async (req, res) => {
  try {
    const Order = require('../models/Order');
    
    // Tìm tất cả đơn hàng của người dùng, sắp xếp theo ngày tạo giảm dần
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('items.product');
    
    res.render('users/orders', {
      title: 'Lịch sử đơn hàng',
      orders
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Không thể tải lịch sử đơn hàng');
    res.redirect('/users/profile');
  }
};

// @desc    Show user addresses page
// @route   GET /users/addresses
exports.showAddresses = async (req, res) => {
  try {
    // Get user with addresses array
    const user = await User.findById(req.user._id);
    
    // If addresses array doesn't exist, initialize it
    if (!user.addresses) {
      user.addresses = [];
      await user.save();
    }
    
    res.render('users/addresses', {
      title: 'Sổ địa chỉ',
      addresses: user.addresses || [],
      defaultAddress: user.defaultAddress || null
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Không thể tải danh sách địa chỉ');
    res.redirect('/users/profile');
  }
};

// @desc    Add new address
// @route   POST /users/addresses
exports.addAddress = async (req, res) => {
  try {
    const { fullName, phone, street, ward, district, city, isDefault } = req.body;
    
    // Validate required fields
    if (!fullName || !phone || !street || !district || !city) {
      req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin');
      return res.redirect('/users/addresses');
    }
    
    const user = await User.findById(req.user._id);
    
    // Initialize addresses array if it doesn't exist
    if (!user.addresses) {
      user.addresses = [];
    }
    
    // Create new address
    const newAddress = {
      _id: new mongoose.Types.ObjectId(),
      fullName,
      phone,
      street,
      ward: ward || '',
      district,
      city,
      isDefault: isDefault === 'on'
    };
    
    // Add to addresses array
    user.addresses.push(newAddress);
    
    // If this is the first address or marked as default, set it as default
    if (isDefault === 'on' || user.addresses.length === 1) {
      user.defaultAddress = newAddress._id;
    }
    
    await user.save();
    
    req.flash('success_msg', 'Thêm địa chỉ thành công');
    res.redirect('/users/addresses');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi thêm địa chỉ');
    res.redirect('/users/addresses');
  }
};

// @desc    Update address
// @route   PUT /users/addresses/:id
exports.updateAddress = async (req, res) => {
  try {
    const { fullName, phone, street, ward, district, city, isDefault } = req.body;
    const addressId = req.params.id;
    
    // Validate required fields
    if (!fullName || !phone || !street || !district || !city) {
      req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin');
      return res.redirect('/users/addresses');
    }
    
    const user = await User.findById(req.user._id);
    
    // Find address index
    const addressIndex = user.addresses.findIndex(
      addr => addr._id.toString() === addressId
    );
    
    if (addressIndex === -1) {
      req.flash('error_msg', 'Không tìm thấy địa chỉ');
      return res.redirect('/users/addresses');
    }
    
    // Update address
    user.addresses[addressIndex] = {
      ...user.addresses[addressIndex],
      fullName,
      phone,
      street,
      ward: ward || '',
      district,
      city,
      isDefault: isDefault === 'on'
    };
    
    // If marked as default, update default address
    if (isDefault === 'on') {
      user.defaultAddress = user.addresses[addressIndex]._id;
    }
    
    await user.save();
    
    req.flash('success_msg', 'Cập nhật địa chỉ thành công');
    res.redirect('/users/addresses');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật địa chỉ');
    res.redirect('/users/addresses');
  }
};

// @desc    Delete address
// @route   DELETE /users/addresses/:id
exports.deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    
    const user = await User.findById(req.user._id);
    
    // Remove address from array
    user.addresses = user.addresses.filter(
      addr => addr._id.toString() !== addressId
    );
    
    // If deleted address was default, update default address
    if (user.defaultAddress && user.defaultAddress.toString() === addressId) {
      user.defaultAddress = user.addresses.length > 0 ? user.addresses[0]._id : null;
    }
    
    await user.save();
    
    req.flash('success_msg', 'Xóa địa chỉ thành công');
    res.redirect('/users/addresses');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xóa địa chỉ');
    res.redirect('/users/addresses');
  }
};

// @desc    Show forgot password page
// @route   GET /users/forgot-password
exports.showForgotPasswordPage = (req, res) => {
  res.render('users/forgot-password', {
    title: 'Quên mật khẩu'
  });
};

// @desc    Process forgot password request
// @route   POST /users/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      req.flash('error_msg', 'Email không tồn tại trong hệ thống');
      return res.redirect('/users/forgot-password');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Set token and expiry on user model
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour

    await user.save();

    // Send email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.name);
      req.flash('success_msg', 'Email đã được gửi với hướng dẫn đặt lại mật khẩu');
      res.redirect('/users/login');
    } catch (err) {
      console.error('Error sending email:', err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      req.flash('error_msg', 'Không thể gửi email đặt lại mật khẩu');
      res.redirect('/users/forgot-password');
    }
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra');
    res.redirect('/users/forgot-password');
  }
};

// @desc    Show reset password page
// @route   GET /users/reset-password/:token
exports.showResetPasswordPage = async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with the token and valid expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error_msg', 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
      return res.redirect('/users/forgot-password');
    }

    res.render('users/reset-password', {
      title: 'Đặt lại mật khẩu',
      token
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra');
    res.redirect('/users/forgot-password');
  }
};

// @desc    Process reset password
// @route   POST /users/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    // Validate password
    if (password !== confirmPassword) {
      req.flash('error_msg', 'Mật khẩu không khớp');
      return res.redirect(`/users/reset-password/${token}`);
    }

    if (password.length < 6) {
      req.flash('error_msg', 'Mật khẩu phải có ít nhất 6 ký tự');
      return res.redirect(`/users/reset-password/${token}`);
    }

    // Find user with the token and valid expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error_msg', 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
      return res.redirect('/users/forgot-password');
    }

    // Set new password and remove reset token fields
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    req.flash('success_msg', 'Mật khẩu đã được cập nhật thành công. Vui lòng đăng nhập.');
    res.redirect('/users/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi đặt lại mật khẩu');
    res.redirect('/users/forgot-password');
  }
};

// @desc    Verify user email
// @route   GET /users/verify/:token
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with the token and valid expiry
    const user = await User.findOne({
      verificationToken: token,
      verificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error_msg', 'Mã xác thực không hợp lệ hoặc đã hết hạn');
      return res.redirect('/users/login');
    }

    // Update user status to verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpire = undefined;

    await user.save();

    req.flash('success_msg', 'Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.');
    res.redirect('/users/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xác thực tài khoản');
    res.redirect('/users/login');
  }
};

// @desc    Show resend verification email page
// @route   GET /users/resend-verification
exports.showResendVerificationPage = (req, res) => {
  res.render('users/resend-verification', {
    title: 'Gửi lại email xác thực'
  });
};

// @desc    Resend verification email
// @route   POST /users/resend-verification
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      req.flash('error_msg', 'Email không tồn tại trong hệ thống');
      return res.redirect('/users/resend-verification');
    }

    if (user.isVerified) {
      req.flash('error_msg', 'Tài khoản này đã được xác thực');
      return res.redirect('/users/login');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationExpire = Date.now() + 86400000; // 24 hours

    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationToken, user.name);
      req.flash('success_msg', 'Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.');
      res.redirect('/users/login');
    } catch (err) {
      console.error('Error sending verification email:', err);
      req.flash('error_msg', 'Không thể gửi email xác thực');
      res.redirect('/users/resend-verification');
    }
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra');
    res.redirect('/users/resend-verification');
  }
};

// @desc    Show edit address page
// @route   GET /users/edit-address/:id
exports.showEditAddressPage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.find(addr => addr._id.toString() === req.params.id);
    if (!address) {
      req.flash('error_msg', 'Không tìm thấy địa chỉ');
      return res.redirect('/users/addresses');
    }
    res.render('users/edit-address', {
      title: 'Chỉnh sửa địa chỉ',
      address,
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra');
    res.redirect('/users/addresses');
  }
}; 