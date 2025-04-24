const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');

// @route   GET /
// @desc    Home page
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Get featured products
    const featuredProducts = await Product.find({ featured: true, status: 'published' })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('category');
    
    // Get new arrivals
    const newArrivals = await Product.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(8);
    
    // Get best sellers
    const bestSellers = await Product.find({ status: 'published' })
      .sort({ sold: -1 })
      .limit(8);
    
    // Get categories with subcategories
    const categories = await Category.find({ parent: null })
      .populate('subcategories');
    
    res.render('index', {
      title: 'Trang chủ',
      featuredProducts,
      newArrivals,
      bestSellers,
      categories
    });
  } catch (err) {
    console.error(err);
    res.render('index', {
      title: 'Trang chủ',
      featuredProducts: [],
      newArrivals: [],
      bestSellers: [],
      categories: []
    });
  }
});

// @route   GET /about
// @desc    About page
// @access  Public
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'Về chúng tôi'
  });
});

// @route   GET /contact
// @desc    Contact page
// @access  Public
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Liên hệ'
  });
});

module.exports = router; 