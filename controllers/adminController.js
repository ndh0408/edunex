const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');
const { validationResult } = require('express-validator');

// Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const [
            totalUsers,
            totalProducts,
            totalOrders,
            recentOrders,
            topProducts
        ] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(),
            Order.countDocuments(),
            Order.find().sort({ createdAt: -1 }).limit(5).populate('user'),
            Product.find().sort({ sales: -1 }).limit(5)
        ]);

        res.locals.layout = 'admin/layout';
        res.render('admin/dashboard', {
            title: 'Dashboard',
            totalUsers,
            totalProducts,
            totalOrders,
            recentOrders,
            topProducts
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading dashboard' });
    }
};

// User Management
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.locals.layout = 'admin/layout';
        res.render('admin/users', { 
            users, 
            title: 'Quản lý người dùng' 
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).render('error', { message: 'Error fetching users' });
    }
};

exports.getUserDetails = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).render('error', { message: 'User not found' });
        }
        res.locals.layout = 'admin/layout';
        res.render('admin/user-details', { user, title: 'Chi tiết người dùng' });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).render('error', { message: 'Error fetching user details' });
    }
};

// Controller for creating a new user (handles POST request)
exports.createUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        errors.array().forEach(error => req.flash('error_msg', error.msg));
        return res.redirect('/admin/users');
    }

    const { name, email, password, role, isActive } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            req.flash('error_msg', 'Email đã tồn tại');
            return res.redirect('/admin/users');
        }

        user = new User({
            name,
            email,
            password,
            role: role || 'user',
            isActive: isActive === 'on' || isActive === true || isActive === 'true'
        });

        await user.save();
        
        req.flash('success_msg', 'Người dùng đã được tạo thành công');
        res.redirect('/admin/users');

    } catch (error) {
        console.error('Create user error:', error);
        req.flash('error_msg', 'Lỗi máy chủ khi tạo người dùng');
        res.redirect('/admin/users');
    }
};

exports.updateUser = async (req, res) => {
    const errors = validationResult(req); // Optional: Add validation if needed
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array(), message: 'Dữ liệu không hợp lệ.' });
    }

    const { name, email, password, role, isActive } = req.body;
    const updateData = {
        name,
        email,
        role,
        isActive: isActive === 'on' || isActive === true || isActive === 'true' // Ensure boolean
    };

    // Only add password to updateData if it's provided and not empty
    // Hashing will be handled by the pre-save hook if password is set
    if (password) {
        updateData.password = password; 
    }

    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        // Update fields
        Object.assign(user, updateData);
        
        // Save the user (this will trigger the pre-save hook for password hashing if password was included)
        await user.save();

        // Don't send password back
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({ success: true, message: 'Cập nhật người dùng thành công', user: userResponse });

    } catch (error) {
        console.error('Update user error:', error);
        // Handle potential duplicate email error during update
        if (error.code === 11000) {
             return res.status(400).json({ success: false, message: 'Email đã được sử dụng bởi tài khoản khác.' });
        }
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật người dùng' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            // Return success: false if user not found
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }
        // Return success: true on successful deletion
        res.json({ success: true, message: 'Xóa người dùng thành công' });
    } catch (error) {
        console.error('Delete user error:', error);
        // Return success: false on server error
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa người dùng' });
    }
};

// Controller to get user details as JSON (for edit modal)
exports.getUserJSON = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password'); // Exclude password
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user); // Send user data as JSON
    } catch (error) {
        console.error('Get user JSON error:', error);
        res.status(500).json({ message: 'Error fetching user data' });
    }
};

// Product Management
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find().populate('category');
        res.locals.layout = 'admin/layout';
        res.render('admin/products', { products, title: 'Quản lý sản phẩm' });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).render('error', { message: 'Error fetching products' });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const product = new Product(req.body);
        await product.save();
        res.status(201).json({ message: 'Product created successfully', product });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ message: 'Error creating product' });
    }
};

exports.updateProduct = async (req, res) => {
  try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
    if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product updated successfully', product });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ message: 'Error updating product' });
    }
};

exports.deleteProduct = async (req, res) => {
  try {
        const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Error deleting product' });
    }
};

// Order Management
exports.getOrders = async (req, res) => {
  try {
        // Pagination parameters
        const currentPage = parseInt(req.query.page) || 1;
        const ordersPerPage = 10; // Or get from config/query

        // Filter for search query
        const searchQuery = req.query.search || '';
        const filter = {};
        if (searchQuery) {
            // Simple search on orderNumber or user name/email (adjust as needed)
            // This requires user to be populated or separate queries
            const userSearch = User.find({ $or: [{name: new RegExp(searchQuery, 'i')}, {email: new RegExp(searchQuery, 'i')}] }).select('_id');
            const userIds = (await userSearch).map(u => u._id);
            filter.$or = [
                { orderNumber: new RegExp(searchQuery, 'i') }, // Search by order number (if you have one)
                { 'shippingAddress.name': new RegExp(searchQuery, 'i') }, // Search by shipping name
                { user: { $in: userIds } } // Search by user ID found from name/email
                // Add other fields to search if needed
            ];
        }

        // Get total count for pagination before applying skip/limit
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / ordersPerPage);

        // Fetch orders for the current page
        const orders = await Order.find(filter)
            .populate('user', 'name email') 
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * ordersPerPage)
            .limit(ordersPerPage);

        // Calculate order statistics (based on *all* orders or just the current page? 
        // Let's calculate based on *all* matching orders for accuracy)
        const allMatchingOrders = await Order.find(filter); // Query again for stats might be inefficient, consider aggregation
        let stats = {
            total: totalOrders, // Use total count
            totalPaid: 0,
            totalUnpaid: 0,
            pending: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            canceled: 0
        };
         allMatchingOrders.forEach(order => {
             if (order.isPaid) {
                 stats.totalPaid++;
             } else {
                 stats.totalUnpaid++;
             }
             if (stats.hasOwnProperty(order.status)) {
                 stats[order.status]++;
             }
         });
        // stats.total = totalOrders; // Already set

        res.locals.layout = 'admin/layout';
        res.render('admin/orders/index', { 
            orders, 
            stats, 
            filter: req.query, 
            search: searchQuery, 
            title: 'Quản lý đơn hàng', 
            currentPage: currentPage, // Pass currentPage
            totalPages: totalPages      // Pass totalPages
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).render('error', { message: 'Error fetching orders' });
    }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
            .populate('user')
            .populate('items.product');
    if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }
        res.locals.layout = 'admin/layout';
        res.render('admin/order-details', { order, title: 'Chi tiết đơn hàng' });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).render('error', { message: 'Error fetching order details' });
    }
};

exports.updateOrderStatus = async (req, res) => {
  try {
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
    if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json({ message: 'Order status updated successfully', order });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ message: 'Error updating order status' });
    }
};

// Category Management
exports.getCategories = async (req, res) => {
    try {
        // Pagination parameters
        const currentPage = parseInt(req.query.page) || 1;
        const categoriesPerPage = 10; // Adjust as needed

        // Search filter
        const searchQuery = req.query.search || '';
        const filter = {};
        if (searchQuery) {
            filter.name = new RegExp(searchQuery, 'i'); 
        }

        // Get total count for pagination
        const totalCategories = await Category.countDocuments(filter);
        const totalPages = Math.ceil(totalCategories / categoriesPerPage);

        // Fetch categories for the current page
        const categories = await Category.find(filter)
            .sort({ order: 1, name: 1 }) // Sort by order, then name
            .skip((currentPage - 1) * categoriesPerPage)
            .limit(categoriesPerPage);
        
        // Add product count to each category (for the current page)
        for (const category of categories) {
            category.productCount = await Product.countDocuments({ category: category._id });
        }

        // Helper function to build pagination URL (keeps existing query params)
        const paginationUrl = (page) => {
            const queryParams = { ...req.query, page };
            return `/admin/categories?${new URLSearchParams(queryParams).toString()}`;
        };

        res.locals.layout = 'admin/layout';
        res.render('admin/categories/index', { 
            categories, 
            search: searchQuery, 
            title: 'Quản lý danh mục',
            currentPage: currentPage,
            totalPages: totalPages,
            paginationUrl: paginationUrl // Pass the helper function
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).render('error', { message: 'Error fetching categories' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const category = new Category(req.body);
        await category.save();
        res.status(201).json({ message: 'Category created successfully', category });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ message: 'Error creating category' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json({ message: 'Category updated successfully', category });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ message: 'Error updating category' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ message: 'Error deleting category' });
    }
};

// Coupon Management
exports.getCoupons = async (req, res) => {
    try {
        // Fetch all users for the owner dropdown
        const users = await User.find().select('id name email').sort({ name: 1 });

        const coupons = await Coupon.find()
            .populate('owner', 'name email') // Populate owner info
            .sort({ createdAt: -1 });
            
        res.locals.layout = 'admin/layout';
        res.render('admin/coupons', { 
            coupons, 
            users, // Pass users to the view
            title: 'Quản lý Coupons' 
        });
    } catch (error) {
        console.error('Get coupons error:', error);
        res.status(500).render('error', { message: 'Lỗi khi tải danh sách coupons' });
    }
};

// Helper function to generate random code (can be placed outside or imported)
function generateCouponCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

exports.createCoupon = async (req, res) => {
    try {
        // Get owner from body
        const { description, discountType, discountValue, minAmount, expiryDate, usageLimit, isActive, owner } = req.body;
        
        let newCode = generateCouponCode(); 

        const newCouponData = {
            code: newCode, 
            description,
            discountType,
            discountValue,
            minAmount: minAmount ? parseFloat(minAmount) : 0, 
            expiryDate,
            usageLimit: usageLimit ? parseInt(usageLimit, 10) : null, 
            isActive: isActive === 'on' || isActive === true || isActive === 'true',
            owner: owner || null // Set owner to null if empty string
        };

        // Validate manually
        if (!discountType || !discountValue || !expiryDate) {
             req.flash('error_msg', 'Loại giảm giá, giá trị giảm và ngày hết hạn là bắt buộc.');
             // Redirect back to the page with the form, potentially passing old input
             // For simplicity, redirecting to the list page for now.
             const users = await User.find().select('id name email').sort({ name: 1 });
             const coupons = await Coupon.find().populate('owner', 'name email').sort({ createdAt: -1 });
             return res.render('admin/coupons', { 
                 coupons, users, title: 'Quản lý Coupons', 
                 error_msg: req.flash('error_msg'), // Make sure flash messages are available
                 // Pass back old input if desired: oldInput: newCouponData
             });
        }

        const newCoupon = new Coupon(newCouponData);
        await newCoupon.save(); 
        
        // Check if email needs to be sent
        if (newCoupon.owner) {
            // TODO: Implement sendCouponEmail(newCoupon.owner, newCoupon);
            console.log(`TODO: Send email to user ${newCoupon.owner} for coupon ${newCoupon.code}`);
        }

        req.flash('success_msg', `Tạo coupon thành công với mã: ${newCoupon.code}`);
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error('Create coupon error:', error);
        // Provide more specific error message from validation if possible
        let errorMessage = 'Lỗi tạo coupon.';
        if (error.errors) { // Check for Mongoose validation errors
             errorMessage = Object.values(error.errors).map(e => e.message).join(', ');
        } else if (error.message) {
            errorMessage = error.message;
        }
        req.flash('error_msg', `Lỗi tạo coupon: ${errorMessage}`);
        res.redirect('/admin/coupons'); 
    }
};

exports.getCouponJSON = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy coupon' });
        }
        res.json({ success: true, coupon }); // Send data wrapped in success
    } catch (error) {
        console.error('Get coupon JSON error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu coupon' });
    }
};

exports.updateCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const updateData = req.body;
        // Ensure isActive is boolean
        updateData.isActive = updateData.isActive === 'on' || updateData.isActive === true || updateData.isActive === 'true'; 
        // Handle owner update
        updateData.owner = updateData.owner || null; 
        // Handle usageLimit
        updateData.usageLimit = updateData.usageLimit ? parseInt(updateData.usageLimit, 10) : null;

        // Find the coupon *before* updating to check if owner changed
        const originalCoupon = await Coupon.findById(couponId);
        if (!originalCoupon) {
             return res.status(404).json({ success: false, message: 'Không tìm thấy coupon' });
        }
        const ownerChanged = originalCoupon.owner?.toString() !== updateData.owner;

        const updatedCoupon = await Coupon.findByIdAndUpdate(couponId, updateData, { new: true, runValidators: true }).populate('owner', 'name email'); // Populate owner in response
        if (!updatedCoupon) {
            // This case might be redundant due to the check above, but keep for safety
            return res.status(404).json({ success: false, message: 'Không tìm thấy coupon sau khi cập nhật' });
        }
        
        // Send email only if owner was added or changed to a different user
        if (updateData.owner && ownerChanged) {
             // TODO: Implement sendCouponEmail(updatedCoupon.owner, updatedCoupon);
             console.log(`TODO: Send email to user ${updatedCoupon.owner._id} for updated/assigned coupon ${updatedCoupon.code}`);
        }
        
        res.json({ success: true, message: 'Cập nhật coupon thành công', coupon: updatedCoupon });
    } catch (error) {
        console.error('Update coupon error:', error);
        res.status(500).json({ success: false, message: `Lỗi cập nhật coupon: ${error.message}` });
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy coupon' });
        }
        res.json({ success: true, message: 'Xóa coupon thành công' });
    } catch (error) {
        console.error('Delete coupon error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa coupon' });
    }
};

// Statistics and Reports
exports.getStatistics = async (req, res) => {
    try {
        const [
            totalSales,
            monthlySales,
            topCategories,
            userGrowth
        ] = await Promise.all([
            Order.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]),
            Order.aggregate([
                { $match: { status: 'completed' } },
                {
                    $group: {
                        _id: { $month: '$createdAt' },
                        total: { $sum: '$total' }
                    }
                }
            ]),
            Category.aggregate([
                {
                    $lookup: {
                        from: 'products',
                        localField: '_id',
                        foreignField: 'category',
                        as: 'products'
                    }
                },
                {
                    $project: {
                        name: 1,
                        productCount: { $size: '$products' }
                    }
                },
                { $sort: { productCount: -1 } },
                { $limit: 5 }
            ]),
            User.aggregate([
                {
                    $group: {
                        _id: { $month: '$createdAt' },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Set the admin layout and title for this page
        res.locals.layout = 'admin/layout';
        res.render('admin/statistics', {
            title: 'Thống kê', // Add title
            totalSales: totalSales[0]?.total || 0,
            monthlySales,
            topCategories,
            userGrowth
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).render('error', { message: 'Error fetching statistics' });
    }
};

exports.getReports = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = { status: 'completed' };
        
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const orders = await Order.find(query)
            .populate('user')
            .populate('items.product')
            .sort({ createdAt: -1 });

        // Add layout and title
        res.locals.layout = 'admin/layout'; 
        res.render('admin/reports', { 
            orders, 
            title: 'Báo cáo', // Add title
            req: req // Pass req object to access query params in view
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).render('error', { message: 'Error generating reports' });
  }
}; 