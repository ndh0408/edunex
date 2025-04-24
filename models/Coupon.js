const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Mã coupon là bắt buộc'],
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  },
  discountType: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed'], // Loại giảm giá: phần trăm hoặc cố định
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: [true, 'Giá trị giảm giá là bắt buộc'],
    min: 0
  },
  minAmount: { // Số tiền tối thiểu để áp dụng coupon
    type: Number,
    default: 0
  },
  expiryDate: {
    type: Date,
    required: [true, 'Ngày hết hạn là bắt buộc']
  },
  usageLimit: { // Giới hạn số lần sử dụng tổng cộng
    type: Number,
    default: null // null = không giới hạn
  },
  usageCount: { // Số lần đã sử dụng
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  owner: { // Trường owner cũ
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Tham chiếu đến model User
    default: null // null = áp dụng cho tất cả người dùng
  }
}, { timestamps: true });

// Validate discount value based on type
CouponSchema.pre('save', function(next) {
  if (this.discountType === 'percentage' && (this.discountValue <= 0 || this.discountValue > 100)) {
    next(new Error('Giá trị giảm giá phần trăm phải từ 1 đến 100'));
  } else if (this.discountType === 'fixed' && this.discountValue <= 0) {
    next(new Error('Giá trị giảm giá cố định phải lớn hơn 0'));
  } else {
    next();
  }
});

// Check if coupon is valid (not expired, within usage limit)
CouponSchema.methods.isValid = function() {
  const now = new Date();
  if (this.expiryDate < now) return false;
  if (this.usageLimit !== null && this.usageCount >= this.usageLimit) return false;
  return this.isActive;
};

module.exports = mongoose.model('Coupon', CouponSchema); 