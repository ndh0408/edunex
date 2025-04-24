const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      name: String,
      image: String,
      price: Number,
      size: String,
      color: String,
      quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
      }
    }
  ],
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 604800 // 7 days in seconds
  }
});

// Calculate cart totals
CartSchema.methods.calculateTotals = function() {
  const subtotal = this.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  return {
    subtotal,
    itemsCount: this.items.length,
    totalQuantity: this.items.reduce((acc, item) => acc + item.quantity, 0)
  };
};

// Add or update item in cart
CartSchema.methods.addItem = function(item) {
  const existingItemIndex = this.items.findIndex(i => 
    i.product.toString() === item.product.toString() && 
    i.size === item.size && 
    i.color === item.color
  );

  if (existingItemIndex > -1) {
    // Update quantity if item exists
    this.items[existingItemIndex].quantity += item.quantity;
  } else {
    // Add new item
    this.items.push(item);
  }
  
  return this.save();
};

// Remove item from cart
CartSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => item._id.toString() !== itemId.toString());
  return this.save();
};

// Update item quantity
CartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const itemIndex = this.items.findIndex(item => item._id.toString() === itemId.toString());
  
  if (itemIndex > -1) {
    this.items[itemIndex].quantity = quantity;
  }
  
  return this.save();
};

// Clear cart
CartSchema.methods.clearCart = function() {
  this.items = [];
  this.coupon = null;
  return this.save();
};

module.exports = mongoose.model('Cart', CartSchema); 