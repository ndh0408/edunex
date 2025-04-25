const User = require('../models/User');
const Cart = require('../models/Cart');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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
    const { name, email, password, password2 } = req.body;
    
    // Validation
    const errors = [];
    
    if (!name || !email || !password || !password2) {
      errors.push({ msg: 'Vui lòng điền đầy đủ thông tin' });
    }
    
    if (password !== password2) {
      errors.push({ msg: 'Mật khẩu không khớp' });
    }
    
    if (password.length < 6) {
      errors.push({ msg: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }
    
    if (errors.length > 0) {
      return res.render('users/register', {
        title: 'Đăng ký tài khoản',
        errors,
        name,
        email
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
        email
      });
    }
    
    // Create new user
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password
    });
    
    // Save user
    await newUser.save();
    
    // Create empty cart for user
    await new Cart({ user: newUser._id, items: [] }).save();
    
    req.flash('success_msg', 'Đăng ký thành công! Vui lòng đăng nhập.');
    res.redirect('/users/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi đăng ký');
    res.redirect('/users/register');
  }
};

// @desc    Login user
// @route   POST /users/login
exports.login = (req, res, next) => {
  try {
    // Kiểm tra CSRF token trước khi xác thực
    if (!req.body._csrf) {
      req.flash('error', 'Phiên làm việc không hợp lệ. Vui lòng thử lại.');
      return res.redirect('/users/login');
    }
    
    // Sử dụng custom callback thay vì options object
    passport.authenticate('local', function(err, user, info) {
      if (err) {
        console.error('Login error:', err);
        req.flash('error', 'Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại sau.');
        return res.redirect('/users/login');
      }
      
      if (!user) {
        // Thông báo lỗi từ passport strategy
        req.flash('error', info.message || 'Email hoặc mật khẩu không chính xác.');
        return res.redirect('/users/login');
      }
      
      // Đăng nhập thành công
      req.logIn(user, function(err) {
        if (err) {
          console.error('Login session error:', err);
          req.flash('error', 'Có lỗi xảy ra khi tạo phiên đăng nhập.');
          return res.redirect('/users/login');
        }
        
        // Lưu thông tin ghi nhớ đăng nhập nếu có
        if (req.body.remember) {
          // Kéo dài thời gian sống của cookie session
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 ngày
        } else {
          // Sử dụng cookie session mặc định
          req.session.cookie.expires = false;
        }
        
        return res.redirect('/');
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
    const user = await User.findById(req.user.id).populate('wishlist');
    
    res.render('users/wishlist', {
      title: 'Sản phẩm yêu thích',
      wishlist: user.wishlist
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Không thể tải danh sách yêu thích');
    res.redirect('/');
  }
};

// @desc    Add product to wishlist (API)
// @route   POST /api/users/wishlist/:productId
exports.addToWishlist = async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Check if product is already in wishlist
    const user = await User.findById(req.user.id);
    const isInWishlist = user.wishlist.includes(productId);
    
    if (isInWishlist) {
      return res.status(400).json({
        success: false,
        message: 'Sản phẩm đã có trong danh sách yêu thích'
      });
    }
    
    // Add to wishlist
    user.wishlist.push(productId);
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Đã thêm vào danh sách yêu thích',
      wishlistCount: user.wishlist.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra'
    });
  }
};

// @desc    Remove product from wishlist (API)
// @route   DELETE /api/users/wishlist/:productId
exports.removeFromWishlist = async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Remove from wishlist
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { wishlist: productId } },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Đã xóa khỏi danh sách yêu thích',
      wishlistCount: user.wishlist.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra'
    });
  }
};

// @desc    Remove product from wishlist (Direct link)
// @route   GET /users/wishlist/remove/:productId
exports.removeWishlistItem = async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Remove from wishlist
    await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { wishlist: productId } }
    );
    
    req.flash('success_msg', 'Đã xóa sản phẩm khỏi danh sách yêu thích');
    res.redirect('/users/wishlist');
  } catch (err) {
    console.error(err);
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