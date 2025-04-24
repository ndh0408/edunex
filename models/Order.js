const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const autoIncrement = require('mongoose-auto-increment');

// Khởi tạo autoIncrement plugin
autoIncrement.initialize(mongoose.connection);

const orderSchema = new Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  items: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      name: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      price: {
        type: Number,
        required: true
      },
      image: String,
      color: String,
      size: String
    }
  ],
  shippingAddress: {
    fullName: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'Việt Nam'
    },
    phone: {
      type: String,
      required: true
    }
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'paypal', 'vnpay'],
    required: true,
    default: 'cod'
  },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String
  },
  itemsPrice: {
    type: Number,
    required: true,
    default: 0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0
  },
  discountPrice: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  isPaid: {
    type: Boolean,
    required: true,
    default: false
  },
  paidAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    required: true,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'canceled'],
    default: 'pending'
  },
  coupon: {
    type: Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  note: {
    type: String
  },
  history: [
    {
      status: String,
      type: {
        type: String,
        enum: ['status', 'payment', 'note'],
        default: 'status'
      },
      message: String,
      note: String,
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, { timestamps: true });

// Plugin để tự động tăng số thứ tự đơn hàng
orderSchema.plugin(autoIncrement.plugin, {
  model: 'Order',
  field: 'counter', 
  startAt: 1,
  incrementBy: 1
});

// Pre-save hook để tạo orderNumber từ counter
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    this.orderNumber = 'ORDER' + String(this.counter).padStart(6, '0');
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order; 