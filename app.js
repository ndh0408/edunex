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
  useUnifiedTopology: true
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

// Cookie parser
app.use(cookieParser());

// Session configuration should be before CSRF
app.use(session({
  secret: process.env.SESSION_SECRET || 'fashionstore_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/fashionstore',
    ttl: 14 * 24 * 60 * 60 // 14 days
  }),
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    httpOnly: true
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Initialize CSRF protection AFTER session and cookie parser
// app.use(csrf());

// CSRF Error Handler (Keep this, place it after session/passport but before routes)
app.use(function (err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN') {
    // CSRF token invalid
    console.log('CSRF attack detected - bad token');
    console.log('Request path:', req.path);
    console.log('Request method:', req.method);
    console.log('Session ID:', req.sessionID);
    let expectedToken = '';
    try {
      // Attempt to get token if available (might fail if middleware didn't run)
      if (req.csrfToken) expectedToken = req.csrfToken(); 
    } catch (e) { /* ignore */ }
    console.log('Received CSRF token:', req.body?._csrf || req.query?._csrf || 'none in body/query');
    
    // Handle CSRF error specifically
    res.status(403).render('error', { 
      message: 'Invalid form submission - token mismatch. Please try again.', 
      error: {} 
    });
  } else {
    // Pass on other errors
    next(err);
  }
});

// Global variables (Add csrfToken here)
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.cart = req.session.cart || [];
  res.locals.totalQty = req.session.totalQty || 0;
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