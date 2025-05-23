const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Order = require('../models/Order');

// @desc    Show all products (with filters and pagination)
// @route   GET /products
exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const startIndex = (page - 1) * limit;
    
    const searchQuery = req.query.search;
    const category = req.query.category;
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const rating = req.query.rating;
    const discount = req.query.discount === 'true';
    const sort = req.query.sort || 'newest';
    
    // Debug logs to verify sort parameter
    console.log("Requested sort:", sort);
    
    let matchStage = { status: 'published' };
    let sortStage = {};
    
    // Process sort parameter
    switch (sort) {
      case 'newest':
        sortStage = { createdAt: -1 };
        break;
      case 'price-asc':
        // Use effectivePrice field for sorting by price
        sortStage = { effectivePrice: 1 };
        break;
      case 'price-desc':
        // Use effectivePrice field for sorting by price
        sortStage = { effectivePrice: -1 };
        break;
      case 'name-asc':
        sortStage = { name: 1 };
        break;
      case 'name-desc':
        sortStage = { name: -1 };
        break;
      case 'rating':
        sortStage = { rating: -1 };
        break;
      default:
        sortStage = { createdAt: -1 };
    }
    
    // Debug logs to verify sort options
    console.log("Applied sort options:", JSON.stringify(sortStage));
    
    // Apply search if provided
    if (searchQuery) {
      matchStage.$text = { $search: searchQuery };
    }
    
    // Apply category filter (handle both single category and array of categories)
    if (category) {
      const categories = Array.isArray(category) ? category : [category];
      const validCategories = categories.filter(cat => mongoose.Types.ObjectId.isValid(cat));
      
      if (validCategories.length > 0) {
        // Get all selected categories and their subcategories
        const categoryIds = [];
        
        for (const catId of validCategories) {
          categoryIds.push(mongoose.Types.ObjectId(catId));
          // Also find subcategories
          const subcategories = await Category.find({ parent: catId });
          categoryIds.push(...subcategories.map(c => c._id));
        }
        
        matchStage.category = { $in: categoryIds };
      }
    }
    
    // Apply price filter
    if (minPrice || maxPrice) {
      matchStage.price = {};
      if (minPrice) matchStage.price.$gte = parseInt(minPrice);
      if (maxPrice) matchStage.price.$lte = parseInt(maxPrice);
    }
    
    // Apply rating filter
    if (rating) {
      matchStage.rating = { $gte: parseInt(rating) };
    }
    
    // Apply discount filter
    if (discount) {
      matchStage.discountPrice = { $gt: 0 };
    }
    
    // Print the query for debugging
    console.log("MongoDB match stage:", JSON.stringify(matchStage));
    
    // Count total number of matching products
    const totalDocs = await Product.countDocuments(matchStage);
    
    // Use aggregation pipeline for better sorting
    const pipeline = [
      // Match products based on filters
      { $match: matchStage },
      
      // Calculate effective price (discounted price or regular price)
      { $addFields: {
        effectivePrice: { 
          $cond: [
            { $and: [
              { $gt: ["$discountPrice", 0] },
              { $lt: ["$discountPrice", "$price"] }
            ]},
            "$discountPrice", 
            "$price"
          ]
        }
      }},
      
      // Sort based on the selected criteria
      { $sort: sortStage },
      
      // Skip and limit for pagination
      { $skip: startIndex },
      { $limit: limit },
      
      // Lookup categories
      { 
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category'
        }
      },
      
      // Unwrap the category array to match the populate behavior
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } }
    ];
    
    // Execute the aggregation pipeline
    const products = await Product.aggregate(pipeline);
    
    // Debug: Log the first few products to verify sort
    if (products.length > 0) {
      console.log("===== SORTED PRODUCTS DEBUG =====");
      console.log(`Sort option: ${sort}`);
      products.slice(0, Math.min(5, products.length)).forEach((product, index) => {
        const effectivePrice = product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price 
          ? product.discountPrice 
          : product.price;
        
        console.log(`${index + 1}: ${product.name} - Effective Price: ${effectivePrice.toLocaleString('vi-VN')} VND`);
      });
      console.log("==============================");
    }
    
    // Get all categories for filter sidebar
    const categories = await Category.find({ parent: null }).populate('subcategories');
    
    // Process selected categories to always be an array
    const selectedCategories = Array.isArray(category) ? category : (category ? [category] : []);
    
    // Tạo hàm phân trang URL
    const paginationUrl = (pageNum) => {
      const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
      url.searchParams.set('page', pageNum);
      return url.pathname + url.search;
    };
    
    res.render('products/index', {
      title: discount ? 'Sản phẩm khuyến mãi' : 'Sản phẩm',
      products,
      categories,
      currentPage: page,
      totalPages: Math.ceil(totalDocs / limit),
      totalProducts: totalDocs,
      search: searchQuery || '',
      filters: {
        minPrice: minPrice || '',
        maxPrice: maxPrice || '',
        rating: rating || ''
      },
      selectedCategories: selectedCategories,
      sort: sort,
      paginationUrl, // Truyền hàm pagination vào template
      queryParams: req.query // Pass all query parameters to the template
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải danh sách sản phẩm');
    res.redirect('/');
  }
};

// @desc    Show single product
// @route   GET /products/:slug
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, status: 'published' })
      .populate('category')
      .populate({
        path: 'reviews',
        populate: { path: 'user', select: 'name' },
        options: { sort: { createdAt: -1 } }
      });
    
    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/products');
    }
    
    // Deep clone the mongoose document to a plain object for manipulation
    const productData = JSON.parse(JSON.stringify(product));
    
    // Log detailed information about the specifications
    console.log('Product ID:', product._id);
    console.log('Product Name:', product.name);
    console.log('Raw specifications data:', JSON.stringify(product.specifications));
    console.log('Specifications type:', typeof product.specifications);
    console.log('Is Array:', Array.isArray(product.specifications));
    if (product.specifications) {
      console.log('Specifications length:', product.specifications.length);
    }
    
    // Ensure specifications is always a properly formatted array
    if (!productData.specifications) {
      productData.specifications = [];
      console.log('No specifications found, setting to empty array');
    } else if (!Array.isArray(productData.specifications)) {
      console.error('Product specifications is not an array:', productData.specifications);
      productData.specifications = [];
      console.log('Converted non-array specifications to empty array');
    } else {
      // Filter out any malformed specification objects
      const originalLength = productData.specifications.length;
      productData.specifications = productData.specifications.filter(spec => 
        spec && typeof spec === 'object' && spec.key && spec.value
      );
      console.log(`Filtered specifications: ${originalLength} -> ${productData.specifications.length}`);
      if (originalLength !== productData.specifications.length) {
        console.log('Removed malformed specifications:', 
          JSON.stringify(product.specifications.filter(spec => 
            !(spec && typeof spec === 'object' && spec.key && spec.value)
          ))
        );
      }
    }
    
    // Get related products
    const relatedProducts = await Product.find({
      category: product.category ? product.category._id : null,
      status: 'published',
      _id: { $ne: product._id }
    })
      .limit(4)
      .sort({ sold: -1 });
    
    // Check if product is in user's wishlist
    let isInWishlist = false;
    if (req.user) {
      isInWishlist = req.user.wishlist.some(
        item => item.toString() === product._id.toString()
      );
    }
    
    // Calculate average rating
    let avgRating = 0;
    if (product.reviews && product.reviews.length > 0) {
      const sumRatings = product.reviews.reduce((acc, review) => acc + review.rating, 0);
      avgRating = sumRatings / product.reviews.length;
    }
    
    let canReview = false;
    if (req.user) {
      // Kiểm tra user đã mua sản phẩm này chưa (đơn hàng đã thanh toán hoặc delivered)
      const orders = await Order.find({
        user: req.user._id,
        isPaid: true,
        'items.product': product._id
      });
      canReview = orders && orders.length > 0;
    }
    
    res.render('products/detail', {
      title: productData.name,
      product: productData,
      relatedProducts,
      isInWishlist,
      avgRating,
      canReview
    });
  } catch (err) {
    console.error('Error in getProduct function:', err);
    console.error('Error stack:', err.stack);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải thông tin sản phẩm');
    res.redirect('/products');
  }
};

// @desc    Create product review
// @route   POST /products/:id/reviews
exports.createReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const productId = req.params.id;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/products');
    }
    
    // Check if user already reviewed this product
    const alreadyReviewed = await Review.findOne({
      user: req.user._id,
      product: productId
    });
    
    if (alreadyReviewed) {
      req.flash('error_msg', 'Bạn đã đánh giá sản phẩm này');
      return res.redirect(`/products/${product.slug}`);
    }
    
    // Create new review
    const review = new Review({
      rating: Number(rating),
      comment,
      user: req.user._id,
      product: productId
    });
    
    await review.save();
    
    req.flash('success_msg', 'Đánh giá thành công, cảm ơn bạn!');
    res.redirect(`/products/${product.slug}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi gửi đánh giá');
    res.redirect(`/products/${req.params.id}`);
  }
};

// API METHODS

// @desc    Search products (API)
// @route   GET /api/products/search
exports.searchProducts = async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return res.status(400).json({ 
        success: false,
        message: 'Vui lòng nhập từ khóa tìm kiếm' 
      });
    }

    // Cải tiến: sử dụng $regex thay vì $text để tìm kiếm linh hoạt hơn
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } }
      ],
      status: 'published'
    })
      .sort({ featured: -1, rating: -1, createdAt: -1 })
      .limit(10)
      .select('name slug images price discountPrice rating');
    
    // Thêm thời gian trễ để kiểm tra loader
    setTimeout(() => {
      res.status(200).json({
        success: true,
        count: products.length,
        data: products
      });
    }, 300);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi tìm kiếm sản phẩm'
    });
  }
};

// @desc    Get product by ID (API)
// @route   GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category')
      .populate({
        path: 'reviews',
        populate: { path: 'user', select: 'name' }
      });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra'
    });
  }
};

// @desc    Show create product form
// @route   GET /products/create
exports.showCreateForm = async (req, res) => {
  try {
    const categories = await Category.find();
    res.render('products/create', {
      title: 'Thêm sản phẩm mới',
      categories
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải form thêm sản phẩm');
    res.redirect('/admin/products');
  }
};

// @desc    Create new product
// @route   POST /products
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      discountPrice,
      category,
      stock,
      specifications
    } = req.body;

    // Handle image upload
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => file.filename);
    }

    // Parse specifications if it's a string
    let parsedSpecifications = [];
    if (specifications) {
      try {
        parsedSpecifications = typeof specifications === 'string' 
          ? JSON.parse(specifications) 
          : specifications;
      } catch (err) {
        console.error('Error parsing specifications:', err);
        parsedSpecifications = [];
      }
    }

    const product = new Product({
      name,
      description,
      price,
      discountPrice,
      category,
      stock,
      specifications: parsedSpecifications,
      images,
      createdBy: req.user._id
    });

    await product.save();
    req.flash('success_msg', 'Thêm sản phẩm thành công');
    res.redirect(`/products/${product.slug}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi thêm sản phẩm');
    res.redirect('/products/create');
  }
};

// @desc    Show edit product form
// @route   GET /products/:id/edit
exports.showEditForm = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const categories = await Category.find();

    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/admin/products');
    }

    res.render('products/edit', {
      title: 'Chỉnh sửa sản phẩm',
      product,
      categories
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải form chỉnh sửa');
    res.redirect('/admin/products');
  }
};

// @desc    Update product
// @route   PUT /products/:id
exports.updateProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      discountPrice,
      category,
      stock,
      specifications
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/admin/products');
    }

    // Handle image upload
    if (req.files && req.files.length > 0) {
      // Remove old images
      product.images.forEach(image => {
        const imagePath = path.join(__dirname, '../public/uploads/products', image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
      // Add new images
      product.images = req.files.map(file => file.filename);
    }

    // Parse specifications if it's a string
    let parsedSpecifications = [];
    if (specifications) {
      try {
        parsedSpecifications = typeof specifications === 'string' 
          ? JSON.parse(specifications) 
          : specifications;
      } catch (err) {
        console.error('Error parsing specifications:', err);
        parsedSpecifications = [];
      }
    }

    // Update product fields
    product.name = name;
    product.description = description;
    product.price = price;
    product.discountPrice = discountPrice;
    product.category = category;
    product.stock = stock;
    product.specifications = parsedSpecifications;
    product.updatedBy = req.user._id;

    await product.save();
    req.flash('success_msg', 'Cập nhật sản phẩm thành công');
    res.redirect(`/products/${product.slug}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật sản phẩm');
    res.redirect(`/products/${req.params.id}/edit`);
  }
};

// @desc    Delete product
// @route   DELETE /products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      req.flash('error_msg', 'Không tìm thấy sản phẩm');
      return res.redirect('/admin/products');
    }

    // Remove product images
    product.images.forEach(image => {
      const imagePath = path.join(__dirname, '../public/uploads/products', image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });

    await product.remove();
    req.flash('success_msg', 'Xóa sản phẩm thành công');
    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xóa sản phẩm');
    res.redirect('/admin/products');
  }
};

// @desc    Add review to product
// @route   POST /api/products/:id/reviews
exports.addReview = async (req, res) => {
  try {
    console.log('Receiving review submission:', req.body);
    const { rating, comment } = req.body;
    const productId = req.params.id;

    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      console.log('Invalid rating:', rating);
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn số sao đánh giá từ 1-5'
      });
    }

    // Check product exists
    const product = await Product.findById(productId);
    if (!product) {
      console.log('Product not found:', productId);
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    // Check user authentication
    if (!req.user) {
      console.log('User not authenticated');
      return res.status(401).json({ 
        success: false, 
        message: 'Bạn cần đăng nhập để đánh giá.' 
      });
    }

    // Check if user has purchased the product
    console.log('Checking orders for user:', req.user._id);
    const orders = await Order.find({
      user: req.user._id,
      'items.product': productId,
      isPaid: true,
      status: { $in: ['delivered', 'shipped'] }
    });

    console.log('Found orders:', orders.length);
    if (!orders || orders.length === 0) {
      console.log('No valid orders found');
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn cần mua và nhận được sản phẩm này mới có thể đánh giá.' 
      });
    }

    // Check if user already reviewed
    const existingReview = await Review.findOne({ 
      user: req.user._id, 
      product: productId 
    });

    if (existingReview) {
      console.log('Updating existing review');
      existingReview.rating = Number(rating);
      existingReview.comment = comment;
      existingReview.createdAt = Date.now();
      await existingReview.save();
      await updateProductRating(productId);
      return res.status(200).json({ 
        success: true, 
        message: 'Đã cập nhật đánh giá của bạn' 
      });
    }

    // Create new review
    console.log('Creating new review');
    const reviewData = {
      user: req.user._id,
      product: productId,
      rating: Number(rating),
      comment: comment,
      createdAt: Date.now()
    };
    const newReview = new Review(reviewData);
    await newReview.save();
    await updateProductRating(productId);

    console.log('Review created successfully');
    return res.status(200).json({ 
      success: true, 
      message: 'Đã gửi đánh giá thành công' 
    });

  } catch (err) {
    console.error('Error in addReview:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Có lỗi xảy ra khi gửi đánh giá' 
    });
  }
};

// Helper function to update product rating
async function updateProductRating(productId) {
  try {
    // Lấy tất cả reviews của sản phẩm từ model Review
    const reviews = await Review.find({ product: productId });
    
    // Update product rating
    const product = await Product.findById(productId);
    
    if (!product) {
      console.error('Product not found when updating rating:', productId);
      return;
    }
    
    if (reviews.length === 0) {
      product.rating = 0;
      product.numReviews = 0;
    } else {
      const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
      product.rating = totalRating / reviews.length;
      product.numReviews = reviews.length;
    }
    
    await product.save();
    console.log('Product rating updated successfully:', { 
      productId, 
      rating: product.rating, 
      numReviews: product.numReviews 
    });
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
} 