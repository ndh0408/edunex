const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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
    const discount = req.query.discount === 'true';
    const sortBy = req.query.sort || 'createdAt';
    const sortOrder = req.query.order || 'desc';
    
    let query = { status: 'published' };
    let sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Apply search if provided
    if (searchQuery) {
      query.$text = { $search: searchQuery };
    }
    
    // Apply category filter
    if (category) {
      // Kiểm tra nếu category là ObjectId hoặc slug
      let categoryFilter;
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryFilter = await Category.findById(category);
      } else {
        categoryFilter = await Category.findOne({ slug: category });
      }
      
      if (categoryFilter) {
        // Tìm tất cả danh mục con
        const subcategories = await Category.find({ parent: categoryFilter._id });
        const categoryIds = [categoryFilter._id, ...subcategories.map(c => c._id)];
        query.category = { $in: categoryIds };
      }
    }
    
    // Apply price filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }
    
    // Apply discount filter
    if (discount) {
      query.discountPrice = { $gt: 0 };
    }
    
    // Get products count
    const total = await Product.countDocuments(query);
    
    // Get products with pagination
    const products = await Product.find(query)
      .sort(sort)
      .skip(startIndex)
      .limit(limit)
      .populate('category');
    
    // Get all categories for filter sidebar
    const categories = await Category.find({ parent: null }).populate('subcategories');
    
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
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      search: searchQuery || '',
      selectedCategory: category || '',
      minPrice: minPrice || '',
      maxPrice: maxPrice || '',
      sort: sortBy,
      order: sortOrder,
      filters: {
        minPrice: minPrice || '',
        maxPrice: maxPrice || ''
      },
      selectedCategories: category ? [category] : [],
      sort: `${sortBy}-${sortOrder}`,
      paginationUrl // Truyền hàm pagination vào template
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
      category: product.category._id,
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
    
    res.render('products/detail', {
      title: productData.name,
      product: productData,
      relatedProducts,
      isInWishlist,
      avgRating
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
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn số sao đánh giá từ 1-5'
      });
    }
    
    const productId = req.params.id;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }
    
    // Tạm thời bỏ kiểm tra đăng nhập
    // Dùng ID người dùng cố định cho mục đích test
    const userId = req.user ? req.user._id : '680b30d696e1c0be05346f4';
    const userName = req.user ? req.user.name : 'Test User';
    
    // Kiểm tra xem người dùng đã đánh giá sản phẩm này chưa
    const existingReview = await Review.findOne({ user: userId, product: productId });
    
    if (existingReview) {
      // Cập nhật đánh giá hiện có
      existingReview.rating = Number(rating);
      existingReview.comment = comment;
      existingReview.createdAt = Date.now();
      await existingReview.save();
      
      // Cập nhật rating cho sản phẩm
      await updateProductRating(productId);
      
      return res.status(200).json({
        success: true,
        message: 'Đã cập nhật đánh giá của bạn'
      });
    } else {
      // Tạo đối tượng Review mới
      const reviewData = {
        user: userId,
        product: productId,
        rating: Number(rating),
        comment: comment,
        createdAt: Date.now()
      };
      
      // Tạo review qua model Review
      const newReview = new Review(reviewData);
      await newReview.save();
      
      // Cập nhật rating cho sản phẩm
      await updateProductRating(productId);
      
      return res.status(201).json({
        success: true,
        message: 'Đã thêm đánh giá thành công'
      });
    }
  } catch (err) {
    console.error('Error in adding review:', err);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra, vui lòng thử lại sau: ' + err.message
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