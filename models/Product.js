const mongoose = require('mongoose');
const slugify = require('mongoose-slug-generator');

mongoose.plugin(slugify);

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vui lòng nhập tên sản phẩm'],
    trim: true
  },
  slug: {
    type: String,
    slug: "name",
    unique: true
  },
  description: {
    type: String,
    required: [true, 'Vui lòng nhập mô tả sản phẩm']
  },
  shortDescription: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Vui lòng nhập giá sản phẩm'],
    min: [0, 'Giá không thể âm']
  },
  discountPrice: {
    type: Number,
    default: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  brand: {
    type: String,
    trim: true
  },
  images: [{
    type: String,
    required: [true, 'Vui lòng thêm ít nhất 1 hình ảnh']
  }],
  colors: [String],
  sizes: [String],
  specifications: [{
    key: String,
    value: String
  }],
  countInStock: {
    type: Number,
    required: [true, 'Vui lòng nhập số lượng tồn kho'],
    min: [0, 'Số lượng không thể âm'],
    default: 0
  },
  sold: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  numReviews: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'outOfStock'],
    default: 'published'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Populate reviews when querying for a product
ProductSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
  justOne: false
});

// Virtual for average rating calculation
ProductSchema.virtual('avgRating').get(function() {
  return this.rating || 0; // Use existing rating field for now
});

// Add index for the rating field to improve sorting performance
ProductSchema.index({ rating: -1 });

// Calculate ratings and save to DB
ProductSchema.methods.updateRatingFromReviews = async function(reviews) {
  if (!reviews || reviews.length === 0) {
    this.rating = 0;
    this.numReviews = 0;
  } else {
    const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
    this.rating = averageRating;
    this.numReviews = reviews.length;
  }
  await this.save();
};

// Create text index for search
ProductSchema.index({ 
  name: 'text', 
  description: 'text',
  brand: 'text'
});

module.exports = mongoose.model('Product', ProductSchema); 