const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Vui lòng nhập mã coupon'],
    unique: true,
    trim: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: [true, 'Vui lòng chọn loại giảm giá']
  },
  amount: {
    type: Number,
    required: [true, 'Vui lòng nhập giá trị giảm giá'],
    min: [0, 'Giá trị giảm giá không thể âm']
  },
  minPurchase: {
    type: Number,
    default: 0,
    min: 0
  },
  startDate: {
    type: Date,
    required: [true, 'Vui lòng chọn ngày bắt đầu']
  },
  endDate: {
    type: Date,
    required: [true, 'Vui lòng chọn ngày kết thúc']
  },
  maxUses: {
    type: Number,
    default: null
  },
  usedCount: {
    type: Number,
    default: 0
  },
  maxUsesPerUser: {
    type: Number,
    default: 1
  },
  usedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    count: {
      type: Number,
      default: 1
    }
  }],
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Check if coupon is valid
CouponSchema.methods.isValid = function(userId, purchaseAmount) {
  const now = new Date();
  
  // Check if coupon is active
  if (!this.isActive) {
    return { valid: false, message: 'Mã giảm giá không hoạt động' };
  }
  
  // Check if coupon has expired
  if (now > this.endDate) {
    return { valid: false, message: 'Mã giảm giá đã hết hạn' };
  }
  
  // Check if coupon is not yet active
  if (now < this.startDate) {
    return { valid: false, message: 'Mã giảm giá chưa được kích hoạt' };
  }
  
  // Check max uses
  if (this.maxUses !== null && this.usedCount >= this.maxUses) {
    return { valid: false, message: 'Mã giảm giá đã hết lượt sử dụng' };
  }
  
  // Check min purchase
  if (purchaseAmount < this.minPurchase) {
    return { 
      valid: false, 
      message: `Giá trị đơn hàng tối thiểu là ${this.minPurchase.toLocaleString('vi-VN')} VND` 
    };
  }
  
  // Check if user has already used this coupon
  if (userId) {
    const userUsage = this.usedBy.find(u => u.user.toString() === userId.toString());
    if (userUsage && userUsage.count >= this.maxUsesPerUser) {
      return { valid: false, message: 'Bạn đã sử dụng hết lượt dùng mã này' };
    }
  }
  
  return { valid: true, message: 'Mã giảm giá hợp lệ' };
};

// Calculate discount amount
CouponSchema.methods.calculateDiscount = function(totalAmount) {
  if (this.type === 'percentage') {
    return (totalAmount * this.amount) / 100;
  } else {
    return this.amount;
  }
};

module.exports = mongoose.model('Coupon', CouponSchema); 