const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Vui lòng đánh giá từ 1-5 sao'],
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: [true, 'Vui lòng nhập nội dung đánh giá'],
    trim: true
  },
  images: [String], // Optional review images
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate reviews from the same user
ReviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Static method to calculate average rating
ReviewSchema.statics.calculateAverageRating = async function(productId) {
  const Product = mongoose.model('Product');
  const result = await this.aggregate([
    { $match: { product: productId, status: 'approved' } },
    { $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        numReviews: { $sum: 1 }
      }
    }
  ]);

  // Update product with new ratings data
  try {
    if (result.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: result[0].averageRating,
        numReviews: result[0].numReviews
      });
    } else {
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        numReviews: 0
      });
    }
  } catch (err) {
    console.error(err);
  }
};

// Call calculateAverageRating after save
ReviewSchema.post('save', function() {
  this.constructor.calculateAverageRating(this.product);
});

// Call calculateAverageRating after remove
ReviewSchema.post('remove', function() {
  this.constructor.calculateAverageRating(this.product);
});

module.exports = mongoose.model('Review', ReviewSchema); 