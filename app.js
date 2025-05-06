require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const methodOverride = require('method-override');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// Initialize app
const app = express();

// Set up DB connection
mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashionstore', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  autoIndex: true, // Đảm bảo index được tạo
  serverSelectionTimeoutMS: 5000, // Tăng timeout
  family: 4 // Sử dụng IPv4
})
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.log(err));

// Passport config
require('./config/passport')(passport);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// EJS Layouts
app.use(expressLayouts);
// Đặt layout mặc định cho các route client
app.set('layout', 'layouts/main');
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(morgan('dev'));

// Cookie parser - ĐẾN TRƯỚC session
app.use(cookieParser(process.env.SESSION_SECRET || 'fashionstore_secret'));

// Session configuration should be before CSRF and passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'fashionstore_secret',
  resave: true,
  saveUninitialized: true,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/fashionstore',
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native', // Tự động xóa session hết hạn
    touchAfter: 24 * 3600 // Cập nhật session time to live mỗi 24 giờ
  }),
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    httpOnly: true,
    secure: false, // Đảm bảo là false khi sử dụng HTTP
    sameSite: 'lax',
    path: '/'
  },
  proxy: true, // Tin tưởng proxy nếu có
  
  // Sử dụng cấu hình này để MongoDB lưu chính xác ID
  genid: function(req) {
    return new mongoose.Types.ObjectId().toString(); // Sử dụng MongoDB ObjectID
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Cấu hình CSRF riêng cho các route cần bảo vệ
const csrfProtection = csrf({
  cookie: {
    key: '_csrf', // Tên cookie
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  }
});

// KHÔNG khởi tạo CSRF protection toàn cục
// app.use(csrf());

// CSRF Error Handler - đặt trước các route
app.use(function (err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);
  
  // Handle CSRF token errors here
  console.log('CSRF error detected:', err.message);
  
  // Clear CSRF cookie to force regeneration
  res.clearCookie('_csrf');
  
  // If it's an API request, send JSON response
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Session expired. Please refresh and try again.', success: false });
  } 
  
  // For login/register forms
  if (req.path === '/users/login' || req.path === '/users/register') {
    req.flash('error', 'Phiên làm việc đã hết hạn. Vui lòng thử lại.');
    // Redirect to the same page using a safer approach
    return res.redirect(req.path);
  }
  
  // For regular requests
  req.flash('error_msg', 'Phiên làm việc đã hết hạn. Vui lòng thử lại.');
  // Redirect to a safe location instead of 'back'
  return res.redirect(req.get('Referrer') || '/');
});

// Global variables
app.use((req, res, next) => {
  console.log('SESSION ID:', req.sessionID);
  console.log('USER DATA:', req.user);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('SESSION COOKIE:', req.session.cookie);
  
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.cart = req.session.cart || [];
  res.locals.totalQty = req.session.totalQty || 0;
  // KHÔNG add CSRF token to all views, chỉ add khi cần
  next();
});

// Global categories middleware
app.use(async (req, res, next) => {
  try {
    const Category = require('./models/Category');
    const categories = await Category.find().sort({ name: 1 });
    res.locals.categories = categories;
    next();
  } catch (err) {
    console.error('Error loading categories:', err);
    res.locals.categories = [];
    next();
  }
});

// Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/products', require('./routes/products'));
app.use('/cart', require('./routes/cart'));
app.use('/orders', require('./routes/orders'));
app.use('/payment', require('./routes/payment'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

// 404 page
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Không tìm thấy trang'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('500', {
    title: 'Lỗi hệ thống',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 