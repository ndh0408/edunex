const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

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
            title: 'Quản lý người dùng', 
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error('Get users error:', error);
        // Ensure layout and title are set for error page
        res.locals.layout = 'admin/layout'; 
        res.status(500).render('error', { 
            title: 'Lỗi hệ thống', // Add title here
            message: 'Error fetching users' 
        });
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
        const categories = await Category.find(); // Get categories for filter

        res.locals.layout = 'admin/layout';
        res.render('admin/products', { 
            products,
            categories, 
            title: 'Quản lý sản phẩm',
            csrfToken: req.csrfToken(),
            filter: req.query,
            search: req.query.search || '',
            currentPage: 1,
            totalPages: 1
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).render('error', { 
            message: 'Error fetching products',
            csrfToken: req.csrfToken()
        });
    }
};

// Add this function to render the create product page
exports.getCreateProductPage = async (req, res) => {
    try {
        const categories = await Category.find();
        res.locals.layout = 'admin/layout'; // Ensure layout is set
        res.render('admin/products/create', {
            title: 'Thêm sản phẩm mới',
            categories: categories
        });
    } catch (error) {
        console.error('Error getting create product page:', error);
        req.flash('error_msg', 'Không thể tải trang thêm sản phẩm.');
        res.redirect('/admin/products');
    }
};

exports.createProduct = async (req, res) => {
    console.log('--- Received req.body ---');
    console.log(JSON.stringify(req.body, null, 2)); // Log incoming body

    // Add validation rules in routes/admin.js later
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Handle validation errors - redirect back with errors
        errors.array().forEach(error => req.flash('error_msg', error.msg));
        // Need to fetch categories again to re-render the create page
        try {
            const categories = await Category.find();
            res.locals.layout = 'admin/layout'; // Ensure layout is set
            return res.render('admin/products/create', { 
                title: 'Thêm sản phẩm mới',
                categories: categories,
                error_msg: req.flash('error_msg'),
                product: req.body // Send back old input
            });
        } catch (fetchError) {
             req.flash('error_msg', 'Lỗi tải trang thêm sản phẩm.');
             return res.redirect('/admin/products');
        }
    }

    try {
        const productData = { ...req.body };

        console.log('--- Initial productData.specifications ---');
        console.log(JSON.stringify(productData.specifications, null, 2)); // Log before processing

        // 1. Handle Images (req.files from multer)
        if (req.files && req.files.length > 0) {
            productData.images = req.files.map(file => file.filename);
        } else {
            // Handle case where no images were uploaded (might be required by schema)
            productData.images = []; // Or handle as error if required
        }

        // 2. Handle Colors and Sizes (split string into array)
        if (productData.colors && typeof productData.colors === 'string') {
            productData.colors = productData.colors.split(',').map(color => color.trim()).filter(Boolean);
        }
        if (productData.sizes && typeof productData.sizes === 'string') {
            productData.sizes = productData.sizes.split(',').map(size => size.trim()).filter(Boolean);
        }

        // 3. Handle Specifications (restructure array)
        if (productData.specifications && typeof productData.specifications === 'object') {
            // Assuming input names like specifications[0][key], specifications[0][value]
            // Object.values might work if the keys are numeric indices from the form
            const specsArray = Object.values(productData.specifications);
            console.log('--- specsArray from Object.values ---');
            console.log(JSON.stringify(specsArray, null, 2)); // Log after Object.values

             // Filter out entries where key or value is empty
            productData.specifications = specsArray.filter(spec => spec && spec.key && spec.key.trim() !== '' && spec.value && spec.value.trim() !== '')
                                               .map(spec => ({ key: spec.key.trim(), value: spec.value.trim() })); 
            
            console.log('--- Final productData.specifications before save ---');
            console.log(JSON.stringify(productData.specifications, null, 2)); // Log after processing
        } else {
            console.log('--- productData.specifications was not an object or did not exist ---');
            productData.specifications = []; // Ensure it's an array if not provided correctly
        }

        // 4. Handle Featured (convert checkbox value)
        productData.featured = productData.featured === 'on' || productData.featured === true || productData.featured === 'true';

        const product = new Product(productData);
        await product.save();

        // 5. Redirect with Flash Message
        req.flash('success_msg', 'Sản phẩm đã được thêm thành công!');
        res.redirect('/admin/products');

    } catch (error) {
        console.error('Create product error:', error);
        let errorMessage = 'Lỗi khi thêm sản phẩm.';
        if (error.errors) { // Mongoose validation errors
            errorMessage = Object.values(error.errors).map(e => e.message).join(', ');
        } else if (error.message) {
            errorMessage = error.message;
        }
        req.flash('error_msg', `Lỗi: ${errorMessage}`);
        
        // Redirect back to create page on error, passing old data
        try {
            const categories = await Category.find();
            res.locals.layout = 'admin/layout'; // Ensure layout is set
            res.render('admin/products/create', { 
                title: 'Thêm sản phẩm mới',
                categories: categories,
                error_msg: req.flash('error_msg'),
                product: req.body // Send back old input
            });
        } catch (fetchError) {
             req.flash('error_msg', 'Lỗi tải trang thêm sản phẩm sau khi có lỗi.');
             res.redirect('/admin/products');
        }
    }
};

exports.updateProduct = async (req, res) => {
    const productId = req.params.id;
    // Add validation rules later if needed
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        errors.array().forEach(error => req.flash('error_msg', error.msg));
        // Redirect back to product list or edit page? Redirecting to list for now.
        return res.redirect('/admin/products'); 
    }

    try {
        const product = await Product.findById(productId);
        if (!product) {
            req.flash('error_msg', 'Không tìm thấy sản phẩm để cập nhật.');
            return res.redirect('/admin/products');
        }

        const updateData = { ...req.body };

        // 1. Handle NEW Images (req.files from multer)
        if (req.files && req.files.length > 0) {
            const newImageFilenames = req.files.map(file => file.filename);
            // Add new images to the existing array (or replace if needed)
            updateData.images = [...(product.images || []), ...newImageFilenames];
            // TODO: Add logic here to potentially remove old images selected for deletion
        } else {
             // Keep existing images if no new files are uploaded
             updateData.images = product.images; 
        }

        // 2. Handle Colors and Sizes (split string into array)
        if (updateData.colors && typeof updateData.colors === 'string') {
            updateData.colors = updateData.colors.split(',').map(color => color.trim()).filter(Boolean);
        }
         if (updateData.sizes && typeof updateData.sizes === 'string') {
            updateData.sizes = updateData.sizes.split(',').map(size => size.trim()).filter(Boolean);
        }

        // 3. Handle Specifications (restructure array)
        if (updateData.specifications && typeof updateData.specifications === 'object') {
            const specsArray = Object.values(updateData.specifications);
            updateData.specifications = specsArray.filter(spec => spec && spec.key && spec.key.trim() !== '' && spec.value && spec.value.trim() !== '')
                                                .map(spec => ({ key: spec.key.trim(), value: spec.value.trim() }));
        } else {
             // If specifications wasn't submitted or malformed, keep the old ones or clear them?
             // Keeping old ones seems safer unless explicitly cleared.
             // If the form *always* submits the specifications field (even if empty), 
             // we might need different logic or a hidden field to indicate clearing.
            updateData.specifications = product.specifications; // Keep old if not submitted correctly
            // Alternatively, if empty submission means clear: updateData.specifications = [];
        }
         // Remove the original specifications object from req.body copy
        delete updateData.specifications; 

        // 4. Handle Featured (convert checkbox value - form sends value only if checked)
        updateData.featured = updateData.featured === 'on' || updateData.featured === true || updateData.featured === 'true';

        // Update the product document
        Object.assign(product, updateData);
        await product.save();

        // 5. Redirect with Flash Message
        req.flash('success_msg', 'Sản phẩm đã được cập nhật thành công!');
        res.redirect('/admin/products');

    } catch (error) {
        console.error(`Update product error for ID ${productId}:`, error);
        let errorMessage = 'Lỗi khi cập nhật sản phẩm.';
        if (error.errors) { // Mongoose validation errors
            errorMessage = Object.values(error.errors).map(e => e.message).join(', ');
        } else if (error.message) {
            errorMessage = error.message;
        }
        req.flash('error_msg', `Lỗi: ${errorMessage}`);
        // Redirect back to product list on error
        res.redirect('/admin/products');
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ 
                success: false,
                message: 'Không tìm thấy sản phẩm'
            });
        }

        // Xóa hình ảnh của sản phẩm
        if (product.images && product.images.length > 0) {
            console.log(`Bắt đầu xóa ${product.images.length} ảnh của sản phẩm ${product._id}`);
            
            for (const image of product.images) {
                // Đường dẫn chính
                const imagePath = path.join(__dirname, '../public/uploads/products', image);
                
                try {
                    // Kiểm tra và xóa file từ đường dẫn chính
                    if (fs.existsSync(imagePath)) {
                        fs.unlinkSync(imagePath);
                        console.log(`Đã xóa ảnh: ${imagePath}`);
                    } else {
                        console.log(`Không tìm thấy ảnh: ${imagePath}`);
                        
                        // Thử tìm trong thư mục uploads (không có thư mục con)
                        const alternativePath = path.join(__dirname, '../public/uploads', image);
                        if (fs.existsSync(alternativePath)) {
                            fs.unlinkSync(alternativePath);
                            console.log(`Đã xóa ảnh từ thư mục uploads: ${alternativePath}`);
                        }
                    }
                } catch (err) {
                    console.error(`Lỗi khi xóa ảnh ${image}:`, err);
                    // Tiếp tục quá trình xóa ngay cả khi xóa ảnh thất bại
                }
            }
        }

        // Xóa sản phẩm
        await product.deleteOne();
        
        console.log(`Đã xóa sản phẩm ${product._id} thành công`);

        res.json({ 
            success: true,
            message: 'Xóa sản phẩm thành công'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Lỗi khi xóa sản phẩm'
        });
    }
};

// Function to get full product details as JSON for the edit modal
exports.getProductJSON = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('category', 'id name'); // Populate category if needed
        if (!product) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
        }
        // We might want to send the category ID directly if the select uses IDs
        const productData = product.toObject(); // Convert to plain object if needed
        if (productData.category) {
          productData.category = productData.category._id; // Send only the ID
        }
        res.json(productData); // Send full product data
    } catch (error) {
        console.error('Get product JSON error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tải dữ liệu sản phẩm' });
    }
};

// Add this function to render the edit product page
exports.getEditProductPage = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);
        const categories = await Category.find();

        if (!product) {
            req.flash('error_msg', 'Không tìm thấy sản phẩm.');
            return res.redirect('/admin/products');
        }
        
        // --- DEBUGGING --- 
        console.log("Product data fetched for edit page:", JSON.stringify(product, null, 2));
        console.log("Specifications:", product.specifications);
        // --- END DEBUGGING ---

        res.locals.layout = 'admin/layout'; // Ensure layout is set
        res.render('admin/products/edit', {
            title: `Chỉnh sửa: ${product.name}`,
            product: product,
            categories: categories,
            csrfToken: req.csrfToken() // Pass CSRF token for the form
        });
    } catch (error) {
        console.error('Error getting edit product page:', error);
        req.flash('error_msg', 'Không thể tải trang chỉnh sửa sản phẩm.');
        res.redirect('/admin/products');
    }
};

// Order Management
exports.getOrders = async (req, res) => {
  try {
        // Pagination parameters
        const currentPage = parseInt(req.query.page) || 1;
        const ordersPerPage = 10;

        // Status filter
        const statusFilter = req.query.status;
        const searchQuery = req.query.search || '';
        const filter = {};

        // Add status filter if provided
        if (statusFilter && statusFilter !== 'all') {
            filter.status = statusFilter;
        }

        // Add search filter if provided
        if (searchQuery) {
            const userSearch = await User.find({
                $or: [
                    {name: new RegExp(searchQuery, 'i')},
                    {email: new RegExp(searchQuery, 'i')}
                ]
            }).select('_id');
            const userIds = userSearch.map(u => u._id);
            
            filter.$or = [
                { orderNumber: new RegExp(searchQuery, 'i') },
                { 'shippingAddress.name': new RegExp(searchQuery, 'i') },
                { 'shippingAddress.phone': new RegExp(searchQuery, 'i') },
                { user: { $in: userIds } }
            ];
        }

        // Get total count for pagination
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / ordersPerPage);

        // Validate current page
        if (currentPage < 1) {
            return res.redirect('/admin/orders?page=1');
        }
        if (totalPages > 0 && currentPage > totalPages) {
            return res.redirect(`/admin/orders?page=${totalPages}`);
        }

        // Fetch orders for current page
        const orders = await Order.find(filter)
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * ordersPerPage)
            .limit(ordersPerPage);

        // Calculate order statistics using aggregation
        const stats = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    totalPaid: {
                        $sum: { $cond: ["$isPaid", 1, 0] }
                    },
                    totalUnpaid: {
                        $sum: { $cond: ["$isPaid", 0, 1] }
                    },
                    pending: {
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                    },
                    processing: {
                        $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] }
                    },
                    shipped: {
                        $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] }
                    },
                    delivered: {
                        $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
                    },
                    canceled: {
                        $sum: { $cond: [{ $eq: ["$status", "canceled"] }, 1, 0] }
                    }
                }
            }
        ]);

        // Create pagination URL helper
        const paginationUrl = (page) => {
            const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
            url.searchParams.set('page', page);
            return url.pathname + url.search;
        };

        // Format statistics
        const orderStats = stats.length > 0 ? stats[0] : {
            total: 0,
            totalPaid: 0,
            totalUnpaid: 0,
            pending: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            canceled: 0
        };

        // Delete _id from stats
        delete orderStats._id;

        res.locals.layout = 'admin/layout';
        res.render('admin/orders/index', {
            title: 'Quản lý đơn hàng',
            orders,
            stats: orderStats,
            filter: req.query,
            search: searchQuery,
            currentStatus: statusFilter || 'all',
            currentPage,
            totalPages,
            paginationUrl,
            moment: require('moment')
        });

    } catch (error) {
        console.error('Get orders error:', error);
        req.flash('error_msg', 'Có lỗi xảy ra khi tải danh sách đơn hàng');
        res.locals.layout = 'admin/layout';
        res.status(500).render('admin/orders/index', {
            title: 'Quản lý đơn hàng',
            orders: [],
            stats: {
                total: 0,
                totalPaid: 0,
                totalUnpaid: 0,
                pending: 0,
                processing: 0,
                shipped: 0,
                delivered: 0,
                canceled: 0
            },
            filter: req.query,
            search: '',
            currentStatus: 'all',
            currentPage: 1,
            totalPages: 1,
            paginationUrl: () => '#',
            moment: require('moment')
        });
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
        res.render('admin/orders/details', { order, title: 'Chi tiết đơn hàng' });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).render('error', { message: 'Error fetching order details' });
    }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    // Cập nhật trạng thái
    const previousStatus = order.status;
    order.status = status;

    // Nếu đơn hàng được đánh dấu là đã giao
    if (status === 'delivered' && previousStatus !== 'delivered') {
      // Cập nhật số lượng tồn kho và số lượng đã bán
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { 
            countInStock: -item.quantity,
            sold: item.quantity
          }
        });
      }
      
      // Cập nhật trạng thái giao hàng
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }
    
    // Nếu đơn hàng bị hủy sau khi đã giao (hiếm khi xảy ra)
    if (status === 'canceled' && previousStatus === 'delivered') {
      // Hoàn lại số lượng vào kho
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { 
            countInStock: item.quantity,
            sold: -item.quantity
          }
        });
      }
      
      order.isDelivered = false;
      order.deliveredAt = null;
    }

    // Thêm vào lịch sử
    order.history.push({
      status: status,
      timestamp: new Date(),
      note: note,
      type: 'status',
      user: req.user._id
    });

    await order.save();
    res.json({ success: true, message: 'Cập nhật trạng thái thành công', order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái đơn hàng' });
  }
};

exports.updateOrderPayment = async (req, res) => {
  try {
    const { transactionId, note } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    // Cập nhật thông tin thanh toán
    order.isPaid = true;
    order.paidAt = new Date();
    if (transactionId) {
      order.paymentResult = {
        id: transactionId,
        status: 'completed',
        update_time: new Date(),
        email_address: order.user ? order.user.email : order.shippingAddress.email
      };
    }

    // Thêm vào lịch sử
    order.history.push({
      type: 'payment',
      timestamp: new Date(),
      message: 'Đã thanh toán đơn hàng',
      note: note,
      user: req.user._id
    });

    await order.save();
    res.json({ success: true, message: 'Cập nhật thanh toán thành công', order });
  } catch (error) {
    console.error('Update order payment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thanh toán' });
  }
};

exports.updateOrderNote = async (req, res) => {
  try {
    const { note } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    // Cập nhật ghi chú
    order.note = note;

    // Thêm vào lịch sử
    order.history.push({
      type: 'note',
      timestamp: new Date(),
      message: 'Đã cập nhật ghi chú',
      note: note,
      user: req.user._id
    });

    await order.save();
    res.json({ success: true, message: 'Cập nhật ghi chú thành công', order });
  } catch (error) {
    console.error('Update order note error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật ghi chú' });
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
            paginationUrl: paginationUrl, // Pass the helper function
            csrfToken: req.csrfToken() // Add CSRF token here
        });
    } catch (error) {
        console.error('Get categories error:', error);
        // Ensure title is passed to error view
        res.status(500).render('error', { 
            title: 'Lỗi hệ thống',
            message: 'Error fetching categories' 
        });
    }
};

exports.createCategory = async (req, res) => {
    try {
        // Get data from form body
        const categoryData = { ...req.body };

        // Check if an image file was uploaded by multer
        if (req.file) {
            // Add the filename to the category data
            // Assuming your Category schema has an 'image' field
            categoryData.image = req.file.filename; 
        } else {
            // Optional: Set a default image or handle case with no image
            categoryData.image = 'default-category.jpg'; // Example default
        }
        
        // Ensure boolean conversion for 'featured' if using checkbox
        categoryData.featured = categoryData.featured === 'on' || categoryData.featured === true || categoryData.featured === 'true';

        const category = new Category(categoryData);
        await category.save();

        // Set success flash message
        req.flash('success_msg', 'Danh mục đã được tạo thành công!');
        // Redirect back to the category list page
        res.redirect('/admin/categories');

    } catch (error) {
        console.error('Create category error:', error);
        // Set error flash message
        let errorMessage = 'Lỗi khi tạo danh mục.';
        if (error.errors) { // Handle Mongoose validation errors
            errorMessage = Object.values(error.errors).map(e => e.message).join(', ');
        } else if (error.message) {
            errorMessage = error.message;
        }
        req.flash('error_msg', `Lỗi: ${errorMessage}`);
        // Redirect back to the category list page even on error
        res.redirect('/admin/categories');
    }
};

exports.updateCategory = async (req, res) => {
    try {
        // Lấy dữ liệu từ form
        const { name, slug, description, order, featured, categoryId } = req.body;
        
        // Tìm danh mục cần cập nhật - dùng params.id thay vì categoryId
        const category = await Category.findById(req.params.id);
        if (!category) {
            req.flash('error_msg', 'Không tìm thấy danh mục');
            return res.redirect('/admin/categories');
        }
        
        // Kiểm tra tên trùng
        if (name !== category.name) {
            const existingCategory = await Category.findOne({ name, _id: { $ne: category._id } });
            if (existingCategory) {
                req.flash('error_msg', 'Danh mục với tên này đã tồn tại');
                return res.redirect('/admin/categories');
            }
        }
        
        // Xử lý upload ảnh
        if (req.file) {
            // Xóa ảnh cũ nếu không phải ảnh mặc định
            if (category.image && category.image !== 'default-category.jpg') {
                try {
                    const oldImagePath = path.join(__dirname, '../public/uploads/categories', category.image);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                } catch (err) {
                    console.error('Error deleting old image:', err);
                }
            }
            // Cập nhật ảnh mới
            category.image = req.file.filename;
        }

        // Cập nhật thông tin danh mục
        category.name = name;
        if (slug) category.slug = slug;
        category.description = description;
        category.order = parseInt(order) || 0;
        category.featured = featured === 'on' || featured === true || featured === 'true';
        
        // Lưu thay đổi
        await category.save();
        
        // Thông báo thành công và chuyển hướng
        req.flash('success_msg', 'Cập nhật danh mục thành công');
        return res.redirect('/admin/categories');
    } catch (error) {
        console.error('Update category error:', error);
        req.flash('error_msg', error.message || 'Lỗi khi cập nhật danh mục');
        return res.redirect('/admin/categories');
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

// Function to handle category deletion via GET request
exports.deleteCategoryByGet = async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        // Check if category exists
        const category = await Category.findById(categoryId);
        if (!category) {
            req.flash('error_msg', 'Không tìm thấy danh mục');
            return res.redirect('/admin/categories');
        }
        
        // Check if category has products
        const productsCount = await Product.countDocuments({ category: categoryId });
        if (productsCount > 0) {
            req.flash('error_msg', `Không thể xóa danh mục này vì có ${productsCount} sản phẩm đang sử dụng`);
            return res.redirect('/admin/categories');
        }
        
        // Delete image if not default
        if (category.image && category.image !== 'default-category.jpg') {
            try {
                const imagePath = path.join(__dirname, '../public/uploads/categories', category.image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            } catch (err) {
                console.error('Error deleting category image:', err);
            }
        }
        
        // Delete category
        await category.deleteOne();
        
        req.flash('success_msg', 'Danh mục đã được xóa thành công');
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Delete category by GET error:', error);
        req.flash('error_msg', 'Có lỗi xảy ra khi xóa danh mục');
        res.redirect('/admin/categories');
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
        // Lấy ngày hiện tại
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-11
        const currentYear = now.getFullYear();
        
        // Lấy ngày đầu tiên của tháng hiện tại
        const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
        
        // Lấy ngày đầu tiên của 11 tháng trước
        const startOfPeriod = new Date(currentYear, currentMonth - 11, 1);

        // Lấy doanh thu theo tháng
        const monthlyRevenue = await Order.aggregate([
            { 
                $match: { 
                    status: 'delivered',
                    createdAt: { $gte: startOfPeriod }
                }
            },
            {
                $addFields: {
                    // Ensure createdAt is a Date object
                    createdAtDate: { $toDate: "$createdAt" }
                }
            },
            {
                $group: {
                    _id: { 
                        year: { $year: "$createdAtDate" },
                        month: { $month: "$createdAtDate" }
                    },
                    revenue: { $sum: '$totalAmount' }
                }
            }
        ]);

        console.log('Raw monthly revenue:', monthlyRevenue); // For debugging

        // Tạo mảng 12 tháng từ quá khứ đến hiện tại
        const monthlyData = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const monthNum = date.getMonth() + 1; // 1-12
            
            // Tìm doanh thu cho tháng này
            const monthRevenue = monthlyRevenue.find(
                item => item._id.year === date.getFullYear() && item._id.month === monthNum
            );
            
            monthlyData.push({
                year: date.getFullYear(),
                month: monthNum,
                monthLabel: `T${monthNum}/${date.getFullYear()}`,
                revenue: monthRevenue ? monthRevenue.revenue : 0
            });
        }

        console.log('Formatted monthly data:', monthlyData); // For debugging

        // Tính các thống kê khác
        const [
            totalRevenue,
            topCategories,
            userGrowth,
            currentMonthRevenue,
            yearlyRevenue
        ] = await Promise.all([
            // Tổng doanh thu
            Order.aggregate([
                { $match: { status: 'delivered' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            // Top danh mục
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
            // Tăng trưởng người dùng
            User.aggregate([
                {
                    $addFields: {
                        // Ensure createdAt is a Date object
                        createdAtDate: { $toDate: "$createdAt" }
                    }
                },
                {
                    $group: {
                        _id: { 
                            year: { $year: "$createdAtDate" },
                            month: { $month: "$createdAtDate" }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 12 }
            ]),
            // Doanh thu tháng hiện tại
            Order.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        createdAt: { $gte: startOfCurrentMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$totalAmount' }
                    }
                }
            ]),
            // Doanh thu năm hiện tại
            Order.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        createdAt: { 
                            $gte: new Date(currentYear, 0, 1) 
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$totalAmount' }
                    }
                }
            ])
        ]);

        // Tính tăng trưởng người dùng
        const currentMonthUsers = userGrowth[0]?.count || 0;
        const lastMonthUsers = userGrowth[1]?.count || 0;
        const growthPercentage = lastMonthUsers ? ((currentMonthUsers - lastMonthUsers) / lastMonthUsers * 100).toFixed(1) : 0;

        res.locals.layout = 'admin/layout';
        res.render('admin/statistics', {
            title: 'Thống kê',
            totalRevenue: totalRevenue[0]?.total || 0,
            monthlyRevenue: monthlyData,
            currentMonthRevenue: currentMonthRevenue[0]?.total || 0,
            yearlyRevenue: yearlyRevenue[0]?.total || 0,
            topCategories,
            userGrowth: growthPercentage
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