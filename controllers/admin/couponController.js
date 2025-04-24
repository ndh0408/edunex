const express = require('express');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/user');
const Coupon = require('../models/coupon');

const router = express.Router();

exports.createCoupon = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', errors.array().map(e => e.msg));
        // Pass users back to the view for repopulating the form
        try {
            const users = await User.find({ role: { $ne: 'admin' } }).select('name email').lean();
            return res.render('admin/coupons', { 
                layout: 'admin/layout', 
                csrfToken: req.csrfToken(),
                messages: req.flash(),
                formData: req.body, // Send back form data
                coupons: await Coupon.find().populate('owner', 'name email').sort({ createdAt: -1 }).lean(), // Repopulate coupons
                users: users // Send users again
            });
        } catch (err) {
            console.error("Error fetching data for coupon creation error handling:", err);
            req.flash('error_msg', 'Đã xảy ra lỗi khi tải lại trang.');
            return res.redirect('/admin/coupons');
        }
    }

    try {
        const { code, description, discountType, discountValue, minAmount, expiryDate, usageLimit, owner, isActive } = req.body;

        // Process owner ID (single or null)
        const ownerId = (owner && mongoose.Types.ObjectId.isValid(owner)) ? owner : null;

        const newCoupon = new Coupon({
            code: code.toUpperCase(),
            description,
            discountType,
            discountValue: parseFloat(discountValue),
            minAmount: minAmount ? parseFloat(minAmount) : 0,
            expiryDate,
            usageLimit: (usageLimit && parseInt(usageLimit, 10) > 0) ? parseInt(usageLimit, 10) : null,
            owner: ownerId, // Use the single processed ID or null
            isActive: isActive === 'on'
        });

        await newCoupon.save();
        req.flash('success_msg', 'Coupon đã được tạo thành công.');
        res.redirect('/admin/coupons');

    } catch (error) {
        console.error('Error creating coupon:', error);
        let errorMsg = 'Đã xảy ra lỗi khi tạo coupon.';
        if (error.code === 11000) { // Handle duplicate code error
            errorMsg = `Mã coupon '${req.body.code}' đã tồn tại. Vui lòng sử dụng mã khác.`;
        } else if (error.message) {
            errorMsg = error.message;
        }
        req.flash('error_msg', errorMsg);
        try {
            const users = await User.find({ role: { $ne: 'admin' } }).select('name email').lean();
            const coupons = await Coupon.find().populate('owner', 'name email').sort({ createdAt: -1 }).lean(); // Keep populate
            res.render('admin/coupons', {
                layout: 'admin/layout',
                csrfToken: req.csrfToken(),
                messages: req.flash(),
                formData: req.body,
                coupons: coupons,
                users: users
            });
        } catch (err) {
            console.error("Error fetching data for coupon creation error handling:", err);
            res.redirect('/admin/coupons');
        }
    }
};

exports.updateCoupon = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array().map(e => e.msg).join(', ') });
    }

    try {
        const { couponId } = req.params;
        const { code, description, discountType, discountValue, minAmount, expiryDate, usageLimit, owner, isActive } = req.body;

        // Process owner ID (single or null)
        const ownerId = (owner && mongoose.Types.ObjectId.isValid(owner)) ? owner : null;

        const updateData = {
            code: code.toUpperCase(),
            description,
            discountType,
            discountValue: parseFloat(discountValue),
            minAmount: minAmount ? parseFloat(minAmount) : 0,
            expiryDate,
            usageLimit: (usageLimit && parseInt(usageLimit, 10) >= 0) ? (parseInt(usageLimit, 10) === 0 ? null : parseInt(usageLimit, 10)) : null,
            owner: ownerId, // Use the single processed ID or null
            isActive: typeof isActive === 'boolean' ? isActive : (isActive === 'on' || isActive === true)
        };

        // Validate discount value based on type before updating
        if (updateData.discountType === 'percentage' && (updateData.discountValue <= 0 || updateData.discountValue > 100)) {
             return res.status(400).json({ success: false, message: 'Giá trị giảm giá phần trăm phải từ 1 đến 100' });
        }
        if (updateData.discountType === 'fixed' && updateData.discountValue <= 0) {
            return res.status(400).json({ success: false, message: 'Giá trị giảm giá cố định phải lớn hơn 0' });
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(couponId, updateData, { new: true, runValidators: false }).populate('owner', 'name email'); // Keep populate

        if (!updatedCoupon) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy coupon.' });
        }

        res.json({ success: true, message: 'Coupon đã được cập nhật thành công.', coupon: updatedCoupon });

    } catch (error) {
        console.error('Error updating coupon:', error);
        let errorMsg = 'Đã xảy ra lỗi khi cập nhật coupon.';
        if (error.code === 11000) { // Handle duplicate code error
            errorMsg = `Mã coupon '${req.body.code}' đã tồn tại. Vui lòng sử dụng mã khác.`;
        }
        res.status(500).json({ success: false, message: errorMsg });
    }
};

exports.getCouponById = async (req, res) => {
    try {
        const { couponId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
             return res.status(400).json({ success: false, message: 'ID coupon không hợp lệ.' });
        }
        // Keep populate here for edit modal
        const coupon = await Coupon.findById(couponId).populate('owner', 'name email _id');

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy coupon.' });
        }
        res.json({ success: true, coupon });
    } catch (error) {
        console.error('Error fetching coupon by ID:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy thông tin coupon.' });
    }
}; 