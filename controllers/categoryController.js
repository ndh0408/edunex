const Category = require('../models/Category');
const Product = require('../models/Product');
const fs = require('fs');
const path = require('path');

// @desc    Get all categories with pagination for admin
// @route   GET /admin/categories
exports.getCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    
    const search = req.query.search || '';
    
    // Build query
    let query = {};
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    // Get total categories count
    const total = await Category.countDocuments(query);
    
    // Get categories with pagination
    const categories = await Category.find(query)
      .skip(startIndex)
      .limit(limit)
      .sort({ order: 1, name: 1 });
    
    // Get product counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ category: category._id });
        return {
          ...category.toObject(),
          productCount
        };
      })
    );
    
    // Pagination URL helper
    const paginationUrl = (pageNum) => {
      let url = `/admin/categories?page=${pageNum}`;
      if (search) url += `&search=${search}`;
      return url;
    };
    
    res.render('admin/categories/index', {
      title: 'Quản lý danh mục',
      path: '/admin/categories',
      categories: categoriesWithCounts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      search,
      paginationUrl,
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tải danh sách danh mục');
    res.redirect('/admin');
  }
};

// @desc    Create a new category
// @route   POST /admin/categories/store
exports.createCategory = async (req, res) => {
  try {
    const { name, slug, order, description, featured } = req.body;
    
    // Check if category with this name already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      req.flash('error_msg', 'Danh mục với tên này đã tồn tại');
      return res.redirect('/admin/categories');
    }
    
    // Create slug if not provided
    let categorySlug = slug;
    if (!categorySlug) {
      categorySlug = name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
    }
    
    // Handle image upload
    let image = 'default-category.jpg';
    if (req.file) {
      image = req.file.filename;
    }
    
    // Create category
    const category = new Category({
      name,
      slug: categorySlug,
      description: description || '',
      image,
      order: order || 0,
      featured: featured === 'on'
    });
    
    await category.save();
    
    req.flash('success_msg', 'Danh mục đã được tạo thành công');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Có lỗi xảy ra khi tạo danh mục');
    res.redirect('/admin/categories');
  }
};

// @desc    Update a category
// @route   POST /admin/categories/update
exports.updateCategory = async (req, res) => {
  try {
    console.log('Update Category Request Body:', req.body);
    const { categoryId, name, slug, order, description, featured } = req.body;
    
    if (!categoryId) {
      req.flash('error_msg', 'ID danh mục không hợp lệ');
      return res.redirect('/admin/categories');
    }
    
    // Kiểm tra danh mục có tồn tại không
    const category = await Category.findById(categoryId);
    if (!category) {
      req.flash('error_msg', 'Không tìm thấy danh mục');
      return res.redirect('/admin/categories');
    }
    
    // Check if name already exists (excluding current category)
    if (name !== category.name) {
      const existingCategory = await Category.findOne({ name, _id: { $ne: categoryId } });
      if (existingCategory) {
        req.flash('error_msg', 'Danh mục với tên này đã tồn tại');
        return res.redirect('/admin/categories');
      }
    }
    
    // Handle image upload
    if (req.file) {
      // Delete old image if it's not the default
      if (category.image !== 'default-category.jpg') {
        try {
          const oldImagePath = path.join('public', 'uploads', category.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (error) {
          console.error('Error deleting old image', error);
        }
      }
      
      // Set new image
      category.image = req.file.filename;
    }
    
    // Update category fields
    category.name = name;
    if (slug) category.slug = slug;
    if (description !== undefined) category.description = description;
    if (order !== undefined) category.order = parseInt(order) || 0;
    category.featured = featured === 'on';
    
    console.log('Updating category:', category);
    await category.save();
    
    req.flash('success_msg', 'Danh mục đã được cập nhật thành công');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('Error updating category:', err);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật danh mục');
    res.redirect('/admin/categories');
  }
};

// @desc    Delete a category
// @route   POST /admin/categories/delete
exports.deleteCategory = async (req, res) => {
  try {
    console.log('Delete Category Request Body:', req.body);
    const { categoryId } = req.body;
    
    if (!categoryId) {
      console.error('Không tìm thấy ID danh mục trong request');
      req.flash('error_msg', 'ID danh mục không hợp lệ');
      return res.redirect('/admin/categories');
    }
    
    console.log('Đang xóa danh mục với ID:', categoryId);
    
    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      console.error('Không tìm thấy danh mục với ID:', categoryId);
      req.flash('error_msg', 'Không tìm thấy danh mục');
      return res.redirect('/admin/categories');
    }
    
    console.log('Đã tìm thấy danh mục:', category.name);
    
    // Check if category has products
    const productsCount = await Product.countDocuments({ category: categoryId });
    if (productsCount > 0) {
      console.error(`Không thể xóa danh mục ${category.name} vì có ${productsCount} sản phẩm đang sử dụng`);
      req.flash('error_msg', `Không thể xóa danh mục này vì có ${productsCount} sản phẩm đang sử dụng`);
      return res.redirect('/admin/categories');
    }
    
    // Delete image if not default
    if (category.image && category.image !== 'default-category.jpg') {
      try {
        const imagePath = path.join('public', 'uploads', category.image);
        console.log('Đang xóa hình ảnh:', imagePath);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log('Đã xóa hình ảnh thành công');
        } else {
          console.log('Không tìm thấy file hình ảnh để xóa');
        }
      } catch (error) {
        console.error('Lỗi khi xóa hình ảnh:', error);
      }
    }
    
    // Delete category
    const result = await Category.findByIdAndDelete(categoryId);
    console.log('Kết quả xóa danh mục:', result ? 'Thành công' : 'Thất bại');
    
    req.flash('success_msg', 'Danh mục đã được xóa thành công');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('Lỗi khi xóa danh mục:', err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xóa danh mục');
    res.redirect('/admin/categories');
  }
};

// @desc    Delete a category by GET request (temporary solution)
// @route   GET /admin/categories/delete/:id
exports.deleteCategoryByGet = async (req, res) => {
  try {
    const categoryId = req.params.id;
    console.log('Xóa danh mục qua GET với ID:', categoryId);
    
    if (!categoryId) {
      console.error('ID danh mục không hợp lệ từ GET request');
      req.flash('error_msg', 'ID danh mục không hợp lệ');
      return res.redirect('/admin/categories');
    }
    
    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      console.error('Không tìm thấy danh mục với ID:', categoryId);
      req.flash('error_msg', 'Không tìm thấy danh mục');
      return res.redirect('/admin/categories');
    }
    
    console.log('Đã tìm thấy danh mục cần xóa:', category.name);
    
    // Check if category has products
    const productsCount = await Product.countDocuments({ category: categoryId });
    if (productsCount > 0) {
      console.error(`Không thể xóa danh mục ${category.name} vì có ${productsCount} sản phẩm đang sử dụng`);
      req.flash('error_msg', `Không thể xóa danh mục này vì có ${productsCount} sản phẩm đang sử dụng`);
      return res.redirect('/admin/categories');
    }
    
    // Delete image if not default
    if (category.image && category.image !== 'default-category.jpg') {
      try {
        const imagePath = path.join('public', 'uploads', category.image);
        console.log('Đang xóa hình ảnh:', imagePath);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log('Đã xóa hình ảnh thành công');
        } else {
          console.log('Không tìm thấy file hình ảnh để xóa');
        }
      } catch (error) {
        console.error('Lỗi khi xóa hình ảnh:', error);
      }
    }
    
    // Delete category
    const result = await Category.findByIdAndDelete(categoryId);
    console.log('Kết quả xóa danh mục:', result ? 'Thành công' : 'Thất bại');
    
    req.flash('success_msg', 'Danh mục đã được xóa thành công');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('Lỗi khi xóa danh mục qua GET:', err);
    req.flash('error_msg', 'Có lỗi xảy ra khi xóa danh mục');
    res.redirect('/admin/categories');
  }
}; 