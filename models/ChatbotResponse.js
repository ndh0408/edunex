const mongoose = require('mongoose');

const ChatbotResponseSchema = new mongoose.Schema({
  keyword: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  response: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['product', 'shipping', 'payment', 'return', 'account', 'general'],
    default: 'general'
  },
  priority: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Tạo index cho tìm kiếm từ khóa
ChatbotResponseSchema.index({ keyword: 'text' });

module.exports = mongoose.model('ChatbotResponse', ChatbotResponseSchema); 