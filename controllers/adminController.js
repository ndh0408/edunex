const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Review = require('../models/Review');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { parse } = require('json2csv');

// DASHBOARD

// @desc    Admin dashboard
// @route   GET /admin
exports.dashboard = async (req, res) => {
  try {
    // Get counts
    const productsCount = await Product.countDocuments();
    const categoriesCount = await Category.countDocuments();
    const ordersCount = await Order.countDocuments();
    const usersCount = await User.countDocuments();
    
    // Get recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
      .select('user status totalAmount createdAt');
    
    // Get top selling products
    const topProducts = await Product.find()
      .sort({ sold: -1 })
      .limit(5);
    
    // Calculate revenue
    const orders = await Order.find({ status: { $ne: 'cancelled' } });
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    
    // Get order counts by status
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const processingOrders = await Order.countDocuments({ status: 'processing' });
    const shippedOrders = await Order.countDocuments({ status: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
    
    // Calculate monthly revenue for chart
    const currentYear = new Date().getFullYear();
    const monthlyRevenue = [];
    const monthNames = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(currentYear, month, 1);
      const endDate = new Date(currentYear, month + 1, 0);
      
      const monthlyOrders = await Order.find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'cancelled' }
      });
      
      const revenue = monthlyOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      monthlyRevenue.push(revenue);
    }
    
    // Prepare chart data
    const chartData = {
      months: monthNames,
      revenue: monthlyRevenue
    };
    
    // Prepare order status counts for chart
    const orderStatusCounts = {
      pending: pendingOrders,
      processing: processingOrders,
      shipped: shippedOrders,
      delivered: deliveredOrders,
      canceled: cancelledOrders
    };
    
    // Prepare stats for cards
    const stats = {
      monthlyRevenue: monthlyRevenue[new Date().getMonth()] || 0,
      annualRevenue: totalRevenue,
      pendingOrders: pendingOrders,
      totalUsers: usersCount
    };
    
    res.render('admin/dashboard/index', {
      title: 'Admin Dashboard',
      path: '/admin',
      productsCount,
      categoriesCount,
      ordersCount,
      usersCount,
      recentOrders,
      topProducts,
      totalRevenue,
      stats,
      chartData,
      orderStatusCounts
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải trang dashboard');
    res.redirect('/admin');
  }
};

// PRODUCTS

// @desc    Show all products
// @route   GET /admin/products
exports.getProducts = async (req, res) => {
  console.log('[getProducts] req.query =', req.query);
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    
    const search = req.query.search || '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    
    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (status) {
      query.status = status;
    }
    
    // Get total products count
    const total = await Product.countDocuments(query);
    
    // Get products with pagination
    const products = await Product.find(query)
      .skip(startIndex)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate('category');
    
    // Get all categories for filter
    const categories = await Category.find();
    
    // Hàm tạo URL phân trang
    const paginationUrl = (pageNum) => {
      let url = `/admin/products?page=${pageNum}`;
      if (search) url += `&search=${search}`;
      if (category) url += `&category=${category}`;
      if (status) url += `&status=${status}`;
      return url;
    };
    
    // Kiểm tra nếu là yêu cầu AJAX
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.json({
        products,
        categories, // Gửi cả categories để cập nhật filter nếu cần
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalProducts: total,
        filter: {
          category: category || '',
          status: status || ''
        },
        search
      });
    } else {
      // Render EJS for the initial load
      res.render('admin/products/index', {
        title: 'Quản lý sản phẩm',
        path: '/admin/products',
        products,
        categories,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalProducts: total,
        search,
        selectedCategory: category,
        selectedStatus: status,
        filter: {
          category: category || '',
          status: status || ''
        },
        paginationUrl, // Chỉ cần cho EJS render
        // Add the script tag to be injected by the layout
        scripts: '<script src="/js/admin-products-ajax.js"></script>',
        // Pass the CSRF token to the template
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    }

  } catch (err) {
    console.error(err);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi tải danh sách sản phẩm' });
    } else {
      req.flash('error_msg', 'Có lỗi xảy ra khi tải danh sách sản phẩm');
      res.redirect('/admin');
    }
  }
};

// @desc    Show create product form
// @route   GET /admin/products/create
exports.showCreateProduct = async (req, res) => {
  try {
    // Get all categories for select dropdown
    const categories = await Category.find();
    
    res.render('admin/products/create', {
      title: 'Thêm sản phẩm mới',
      path: '/admin/products',
      categories
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải trang thêm sản phẩm');
    res.redirect('/admin/products');
  }
};

// @desc    Create product
// @route   POST /admin/products
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      shortDescription,
      price,
      discountPrice,
      category,
      brand,
      countInStock,
      colors,
      sizes,
      featured,
      status
    } = req.body;
    
    // Handle uploaded images
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push(file.filename);
      });
    }
    
    // Process specifications
    let specifications = [];
    if (req.body.specifications) {
      console.log('Raw specifications data from form:', req.body.specifications);
      
      // Check if specifications is already an array of objects with key and value
      if (Array.isArray(req.body.specifications)) {
        console.log('Processing specifications in direct array format');
        req.body.specifications.forEach(spec => {
          if (spec && spec.key && spec.value) {
            specifications.push({
              key: spec.key,
              value: spec.value
            });
          }
        });
      }
      // Check if specifications are in the keys/values array format
      else if (req.body.specifications.keys && Array.isArray(req.body.specifications.keys)) {
        console.log('Processing specifications in keys/values array format');
        const keys = req.body.specifications.keys;
        const values = req.body.specifications.values || [];
        
        for (let i = 0; i < keys.length; i++) {
          if (keys[i] && values[i]) {
            specifications.push({
              key: keys[i],
              value: values[i]
            });
          }
        }
      } 
      // Check if specifications are in the indexed format (specifications[0][key], specifications[0][value])
      else {
        console.log('Processing specifications in indexed format');
        // First, collect all indices from the specifications object keys
        const indices = new Set();
        Object.keys(req.body.specifications).forEach(key => {
          const match = key.match(/\[(\d+)\]/);
          if (match && match[1]) {
            indices.add(match[1]);
          }
        });
        
        // Then process each index
        indices.forEach(index => {
          const key = req.body.specifications[`${index}[key]`];
          const value = req.body.specifications[`${index}[value]`];
          
          if (key && value) {
            specifications.push({
              key: key,
              value: value
            });
          }
        });
      }
    }
    
    console.log('Processed specifications:', specifications);
    
    // Create product
    const product = new Product({
      name,
      description,
      shortDescription,
      price,
      discountPrice: discountPrice || 0,
      category,
      brand,
      images,
      colors: colors ? colors.split(',').map(color => color.trim()) : [],
      sizes: sizes ? sizes.split(',').map(size => size.trim()) : [],
      specifications,
      countInStock,
      featured: featured === 'on',
      status: status || 'published'
    });
    
    await product.save();
    
    req.flash('success_msg', 'Sản phẩm đã được tạo thành công');
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Lỗi khi tạo sản phẩm:', err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tạo sản phẩm: ' + err.message);
    res.redirect('/admin/products/create');
  }
};

// @desc    Show edit product form
// @route   GET /admin/products/:id/edit
exports.showEditProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/admin/products');
    }
    
    // Get all categories for select dropdown
    const categories = await Category.find();
    
    res.render('admin/products/edit', {
      title: 'Chỉnh sửa sản phẩm',
      path: '/admin/products',
      product,
      categories
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải trang chỉnh sửa sản phẩm');
    res.redirect('/admin/products');
  }
};

// @desc    Update product
// @route   PUT /admin/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      shortDescription,
      price,
      discountPrice,
      category,
      brand,
      countInStock,
      colors,
      sizes,
      featured,
      status,
      existingImages
    } = req.body;
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/admin/products');
    }
    
    // Handle images
    let images = existingImages ? (Array.isArray(existingImages) ? existingImages : [existingImages]) : [];
    
    // Add new uploaded images
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push(file.filename);
      });
    }
    
    // Process specifications
    let specifications = [];
    if (req.body.specifications) {
      console.log('Raw specifications data from form:', req.body.specifications);
      
      // Check if specifications is already an array of objects with key and value
      if (Array.isArray(req.body.specifications)) {
        console.log('Processing specifications in direct array format');
        req.body.specifications.forEach(spec => {
          if (spec && spec.key && spec.value) {
            specifications.push({
              key: spec.key,
              value: spec.value
            });
          }
        });
      }
      // Check if specifications are in the keys/values array format
      else if (req.body.specifications.keys && Array.isArray(req.body.specifications.keys)) {
        console.log('Processing specifications in keys/values array format');
        const keys = req.body.specifications.keys;
        const values = req.body.specifications.values || [];
        
        for (let i = 0; i < keys.length; i++) {
          if (keys[i] && values[i]) {
            specifications.push({
              key: keys[i],
              value: values[i]
            });
          }
        }
      } 
      // Check if specifications are in the indexed format (specifications[0][key], specifications[0][value])
      else {
        console.log('Processing specifications in indexed format');
        // First, collect all indices from the specifications object keys
        const indices = new Set();
        Object.keys(req.body.specifications).forEach(key => {
          const match = key.match(/\[(\d+)\]/);
          if (match && match[1]) {
            indices.add(match[1]);
          }
        });
        
        // Then process each index
        indices.forEach(index => {
          const key = req.body.specifications[`${index}[key]`];
          const value = req.body.specifications[`${index}[value]`];
          
          if (key && value) {
            specifications.push({
              key: key,
              value: value
            });
          }
        });
      }
    }
    
    console.log('Processed specifications:', specifications);
    
    // Update product
    product.name = name;
    product.description = description;
    product.shortDescription = shortDescription;
    product.price = price;
    product.discountPrice = discountPrice || 0;
    product.category = category;
    product.brand = brand;
    product.images = images;
    product.colors = colors ? colors.split(',').map(color => color.trim()) : [];
    product.sizes = sizes ? sizes.split(',').map(size => size.trim()) : [];
    product.specifications = specifications;
    product.countInStock = countInStock;
    product.featured = featured === 'on';
    product.status = status || 'published';
    
    await product.save();
    
    req.flash('success_msg', 'Sản phẩm đã được cập nhật thành công');
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Lỗi khi cập nhật sản phẩm:', err);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật sản phẩm: ' + err.message);
    res.redirect(`/admin/products/${req.params.id}/edit`);
  }
};

// @desc    Delete product
// @route   DELETE /admin/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/admin/products');
    }
    
    // Delete product images from server
    if (product.images && product.images.length > 0) {
      product.images.forEach(image => {
        const imagePath = path.join(__dirname, '../public/uploads/', image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
    }
    
    // Delete product
    await product.remove();
    
    // Delete related reviews
    await Review.deleteMany({ product: req.params.id });
    
    // Trả về JSON nếu là AJAX
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.json({ success: true, message: 'Sản phẩm đã được xóa thành công' });
    } else {
      req.flash('success_msg', 'Sản phẩm đã được xóa thành công');
      res.redirect('/admin/products');
    }

  } catch (err) {
    console.error(err);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi xóa sản phẩm' });
    } else {
      req.flash('error_msg', 'Có lỗi xảy ra khi xóa sản phẩm');
      res.redirect('/admin/products');
    }
  }
};

// ORDERS

// @desc    Hiển thị tất cả đơn hàng
// @route   GET /admin/orders
exports.getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    
    const status = req.query.status || '';
    const search = req.query.search || '';
    const paymentMethod = req.query.paymentMethod || '';
    const dateRange = req.query.dateRange || '';
    
    // Xây dựng query
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    
    // Xử lý tìm kiếm theo khoảng thời gian
    if (dateRange) {
      const dates = dateRange.split(' to ');
      if (dates.length === 2) {
        const startDate = moment(dates[0], 'DD/MM/YYYY').startOf('day');
        const endDate = moment(dates[1], 'DD/MM/YYYY').endOf('day');
        
        // Kiểm tra xem ngày có hợp lệ không sau khi parse bằng moment
        if (startDate.isValid() && endDate.isValid()) { 
          query.createdAt = {
            $gte: startDate.toDate(),
            $lte: endDate.toDate()
          };
          console.log('[Get Orders] Date range filter applied:', query.createdAt);
        } else {
          console.warn('[Get Orders] Invalid date format received:', dateRange);
        }
      } else {
        console.warn('[Get Orders] Invalid date range format received:', dateRange);
      }
    }
    
    if (search) {
      // Tìm kiếm theo mã đơn hàng, tên khách hàng, hoặc email
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      });
      
      const userIds = users.map(user => user._id);
      
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { user: { $in: userIds } },
        { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Đếm tổng số đơn hàng thỏa mãn điều kiện
    const total = await Order.countDocuments(query);
    
    // Lấy đơn hàng với phân trang
    const orders = await Order.find(query)
      .skip(startIndex)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate('user', 'name email');
    
    // Tạo hàm URL phân trang
    const paginationUrl = (pageNum) => {
      let url = `/admin/orders?page=${pageNum}`;
      if (status) url += `&status=${status}`;
      if (paymentMethod) url += `&paymentMethod=${paymentMethod}`;
      if (search) url += `&search=${search}`;
      if (dateRange) url += `&dateRange=${encodeURIComponent(dateRange)}`;
      return url;
    };
    
    // Tính toán thống kê
    const stats = {
      pending: await Order.countDocuments({ status: 'pending' }),
      processing: await Order.countDocuments({ status: 'processing' }),
      shipped: await Order.countDocuments({ status: 'shipped' }),
      delivered: await Order.countDocuments({ status: 'delivered' }),
      canceled: await Order.countDocuments({ status: 'canceled' }),
      total: await Order.countDocuments(),
      totalPaid: await Order.countDocuments({ isPaid: true }),
      totalUnpaid: await Order.countDocuments({ isPaid: false })
    };
    
    // Check if AJAX request
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      // Return JSON data
      return res.json({
        orders,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        stats,
        filter: {
          status: status || '',
          paymentMethod: paymentMethod || '',
          dateRange: dateRange || ''
        },
        search
      });
    } else {
      // Render EJS template for normal request
      res.render('admin/orders/index', {
        title: 'Quản lý đơn hàng',
        path: '/admin/orders',
        orders,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        stats,
        selectedStatus: status, 
        search,
        dateRange,
        filter: {
          status: status || '',
          paymentMethod: paymentMethod || '',
          dateRange: dateRange || ''
        },
        paginationUrl // Pass the helper function for EJS rendering
      });
    }

  } catch (err) {
    console.error(err);
    // Handle error for both AJAX and normal requests
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi tải danh sách đơn hàng' });
    } else {
      req.flash('error_msg', 'Có lỗi xảy ra khi tải danh sách đơn hàng');
      res.redirect('/admin');
    }
  }
};

// @desc    Hiển thị chi tiết đơn hàng
// @route   GET /admin/orders/:id
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product')
      .populate({
        path: 'history.user',
        select: 'name email role'
      });
    
    if (!order) {
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/admin/orders');
    }
    
    res.render('admin/orders/details', {
      title: `Đơn hàng #${order.orderNumber || order._id}`,
      path: '/admin/orders',
      order,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải thông tin đơn hàng');
    res.redirect('/admin/orders');
  }
};

// @desc    Cập nhật trạng thái đơn hàng
// @route   PUT|POST /admin/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    
    if (!['pending', 'processing', 'shipped', 'delivered', 'canceled'].includes(status)) {
      req.flash('error_msg', 'Trạng thái đơn hàng không hợp lệ');
      return res.redirect(`/admin/orders/${req.params.id}`);
    }
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/admin/orders');
    }
    
    // Kiểm tra nếu trạng thái không thay đổi
    if (order.status === status) {
      req.flash('info_msg', 'Không có thay đổi nào về trạng thái đơn hàng');
      return res.redirect(`/admin/orders/${req.params.id}`);
    }
    
    const previousStatus = order.status;
    
    // Xử lý các trường hợp đặc biệt
    if (status === 'delivered' && !order.isDelivered) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
    }
    
    if (status === 'canceled' && order.status !== 'canceled') {
      // Hoàn trả sản phẩm vào kho khi hủy đơn hàng
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { 
            countInStock: item.quantity,
            sold: -item.quantity
          }
        });
      }
    }
    
    // Cập nhật trạng thái
    order.status = status;
    
    // Tạo lịch sử
    if (!order.history) {
      order.history = [];
    }
    
    // Tạo thông điệp dựa trên trạng thái
    let statusMessage = '';
    switch (status) {
      case 'pending':
        statusMessage = 'Đơn hàng đã được tạo';
        break;
      case 'processing':
        statusMessage = 'Đơn hàng đang được xử lý';
        break;
      case 'shipped':
        statusMessage = 'Đơn hàng đang được giao';
        break;
      case 'delivered':
        statusMessage = 'Đơn hàng đã được giao thành công';
        break;
      case 'canceled':
        statusMessage = 'Đơn hàng đã bị hủy';
        break;
      default:
        statusMessage = 'Trạng thái đơn hàng đã được cập nhật';
    }
    
    order.history.push({
      status: status,
      type: 'status',
      message: statusMessage,
      note: note || `Thay đổi từ ${previousStatus} thành ${status}`,
      user: req.user._id,
      timestamp: Date.now()
    });
    
    await order.save();
    
    // Send response
    if (req.xhr) {
      res.status(200).json({ success: true, message: 'Đã cập nhật trạng thái đơn hàng thành công' });
    } else {
      req.flash('success_msg', 'Đã cập nhật trạng thái đơn hàng');
      res.redirect(`/admin/orders/${req.params.id}`);
    }
  } catch (err) {
    console.error(err);
    // Send error response
    if (req.xhr) {
      res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng' });
    } else {
      req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng');
      res.redirect(`/admin/orders/${req.params.id}`);
    }
  }
};

// @desc    Cập nhật trạng thái thanh toán
// @route   PUT|POST /admin/orders/:id/payment
exports.updateOrderPayment = async (req, res) => {
  try {
    const { transactionId, note } = req.body;
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      if (req.xhr) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      }
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/admin/orders');
    }
    
    // Kiểm tra nếu đơn hàng đã thanh toán
    if (order.isPaid) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Đơn hàng này đã được thanh toán rồi' });
      }
      req.flash('info_msg', 'Đơn hàng này đã được thanh toán rồi');
      return res.redirect(`/admin/orders/${req.params.id}`);
    }
    
    // Cập nhật đơn hàng
    order.isPaid = true;
    order.paidAt = Date.now();
    
    if (transactionId) {
      order.paymentResult = {
        id: transactionId,
        status: 'Completed',
        update_time: new Date().toISOString(),
        email_address: order.user ? order.user.email : ''
      };
    }
    
    // Lưu lịch sử thanh toán
    if (!order.history) {
      order.history = [];
    }
    
    order.history.push({
      status: order.status,
      type: 'payment',
      message: 'Đơn hàng đã được thanh toán',
      note: note || 'Thanh toán được xác nhận bởi quản trị viên',
      user: req.user._id,
      timestamp: Date.now()
    });
    
    await order.save();
    
    if (req.xhr) {
      res.status(200).json({ success: true, message: 'Cập nhật trạng thái thanh toán thành công' });
    } else {
      req.flash('success_msg', 'Đã cập nhật trạng thái thanh toán');
      res.redirect(`/admin/orders/${req.params.id}`);
    }
  } catch (err) {
    console.error(err);
    if (req.xhr) {
      res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi cập nhật trạng thái thanh toán' });
    } else {
      req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật trạng thái thanh toán');
      res.redirect(`/admin/orders/${req.params.id}`);
    }
  }
};

// @desc    Cập nhật ghi chú đơn hàng
// @route   PUT|POST /admin/orders/:id/note
exports.updateOrderNote = async (req, res) => {
  try {
    const { note } = req.body;
    
    if (!note || note.trim() === '') {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Ghi chú không được để trống' });
      }
      req.flash('error_msg', 'Ghi chú không được để trống');
      return res.redirect(`/admin/orders/${req.params.id}`);
    }
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      if (req.xhr) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      }
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/admin/orders');
    }
    
    // Cập nhật ghi chú
    order.note = note;
    
    // Lưu lịch sử
    if (!order.history) {
      order.history = [];
    }
    
    order.history.push({
      status: order.status,
      type: 'note',
      message: 'Ghi chú đơn hàng đã được cập nhật',
      note: note,
      user: req.user._id,
      timestamp: Date.now()
    });
    
    await order.save();
    
    if (req.xhr) {
      res.status(200).json({ success: true, message: 'Cập nhật ghi chú thành công' });
    } else {
      req.flash('success_msg', 'Đã cập nhật ghi chú đơn hàng');
      res.redirect(`/admin/orders/${req.params.id}`);
    }
  } catch (err) {
    console.error(err);
    if (req.xhr) {
      res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi cập nhật ghi chú' });
    } else {
      req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật ghi chú');
      res.redirect(`/admin/orders/${req.params.id}`);
    }
  }
};

// @desc    Tạo hóa đơn đơn hàng
// @route   GET /admin/orders/:id/invoice
exports.getOrderInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product');
    
    if (!order) {
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/admin/orders');
    }
    
    res.render('admin/orders/invoice', {
      layout: false,
      order
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tạo hóa đơn');
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};

// @desc    Xuất danh sách đơn hàng ra CSV
// @route   GET /admin/orders/export
exports.exportOrders = async (req, res) => {
  try {
    console.log('[Export Orders] Starting export...');
    // Lấy bộ lọc từ query parameters (tương tự getOrders)
    const { status, paymentMethod, dateRange, search } = req.query;
    let query = {};

    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (dateRange) {
      const dates = dateRange.split(' - ');
      if (dates.length === 2) {
        const startDate = moment(dates[0], 'DD/MM/YYYY').startOf('day');
        const endDate = moment(dates[1], 'DD/MM/YYYY').endOf('day');
        if (startDate.isValid() && endDate.isValid()) {
          query.createdAt = {
            $gte: startDate.toDate(),
            $lte: endDate.toDate()
          };
        }
      }
    }
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      });
      const userIds = users.map(user => user._id);
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { user: { $in: userIds } },
        { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } }
      ];
    }

    console.log('[Export Orders] Query built:', query);

    // Lấy tất cả đơn hàng phù hợp (không phân trang)
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name email');

    console.log(`[Export Orders] Found ${orders.length} orders to export.`);

    // Chuẩn bị dữ liệu CSV
    const json2csvParser = new parse({ fields, header: true, delimiter: ';' }); // Use semicolon for Excel
    const csv = json2csvParser.parse(orders);

    console.log('[Export Orders] CSV data generated.');

    // Thiết lập header để trình duyệt tải file
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders_export_${moment().format('YYYYMMDDHHmmss')}.csv"`);
    
    // Gửi dữ liệu CSV (đảm bảo BOM cho UTF-8 trong Excel)
    res.status(200).send('\uFEFF' + csv);
    console.log('[Export Orders] CSV sent to client.');

  } catch (err) {
    console.error('[Export Orders] Error:', err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xuất danh sách đơn hàng');
    res.redirect('/admin/orders');
  }
};

// USERS

// @desc    Show all users
// @route   GET /admin/users
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    
    const search = req.query.search || '';
    const role = req.query.role || '';
    
    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      query.role = role;
    }
    
    // Get total users count
    const total = await User.countDocuments(query);
    
    // Get users with pagination
    const users = await User.find(query)
      .skip(startIndex)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    res.render('admin/users/index', {
      title: 'Quản lý người dùng',
      path: '/admin/users',
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total,
      search,
      selectedRole: role
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải danh sách người dùng');
    res.redirect('/admin');
  }
};

// @desc    Show user details
// @route   GET /admin/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error_msg', 'Không tìm thấy người dùng');
      return res.redirect('/admin/users');
    }
    
    // Get user orders
    const orders = await Order.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get user reviews
    const reviews = await Review.find({ user: req.params.id })
      .populate('product', 'name slug images')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.render('admin/users/details', {
      title: `Người dùng: ${user.name}`,
      path: '/admin/users',
      user,
      orders,
      reviews
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải thông tin người dùng');
    res.redirect('/admin/users');
  }
};

// @desc    Update user role
// @route   PUT /admin/users/:id/role
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin', 'manager'].includes(role)) {
      req.flash('error_msg', 'Vai trò không hợp lệ');
      return res.redirect(`/admin/users/${req.params.id}`);
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error_msg', 'Không tìm thấy người dùng');
      return res.redirect('/admin/users');
    }
    
    // Prevent changing role of the last admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        req.flash('error_msg', 'Không thể thay đổi vai trò của người quản trị cuối cùng');
        return res.redirect(`/admin/users/${req.params.id}`);
      }
    }
    
    // Update role
    user.role = role;
    await user.save();
    
    req.flash('success_msg', 'Đã cập nhật vai trò người dùng');
    res.redirect(`/admin/users/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật vai trò người dùng');
    res.redirect(`/admin/users/${req.params.id}`);
  }
}; 