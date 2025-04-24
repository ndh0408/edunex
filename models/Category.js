const mongoose = require('mongoose');
const slugify = require('mongoose-slug-generator');

mongoose.plugin(slugify);

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  slug: {
    type: String,
    slug: "name",
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    default: 'default-category.jpg'
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for subcategories
CategorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
  justOne: false
});

// Static method to get all categories with their subcategories
CategorySchema.statics.getNestedCategories = async function() {
  const categories = await this.find({ parent: null }).populate('subcategories');
  return categories;
};

module.exports = mongoose.model('Category', CategorySchema); 