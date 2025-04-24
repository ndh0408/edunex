// Script khởi tạo tài khoản admin
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Kết nối MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/edunex', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Đã kết nối MongoDB thành công');
  } catch (err) {
    console.error('❌ Lỗi kết nối MongoDB:', err);
    process.exit(1);
  }
};

// Tạo tài khoản admin
const createAdmin = async () => {
  try {
    // Kiểm tra xem đã có tài khoản admin chưa
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('⚠️ Tài khoản admin đã tồn tại, không cần tạo mới');
      return;
    }

    // Mật khẩu mặc định
    const defaultPassword = '123456';

    // Tạo admin
    const admin = new User({
      name: 'Admin',
      email: 'admin@example.com',
      password: defaultPassword,
      phone: '0987654321',
      address: 'Hà Nội, Việt Nam',
      role: 'admin'
    });
    await admin.save();

    console.log('✅ Đã tạo tài khoản admin thành công');
    console.log('📧 Email: admin@example.com');
    console.log('🔑 Mật khẩu: 123456');
  } catch (error) {
    console.error('❌ Lỗi khi tạo tài khoản admin:', error);
    throw error;
  }
};

// Hàm chính
const seedAdmin = async () => {
  try {
    // Kết nối database
    await connectDB();
    
    // Tạo tài khoản admin
    await createAdmin();
    
    console.log('✅ Đã hoàn thành khởi tạo dữ liệu');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi trong quá trình khởi tạo dữ liệu:', error);
    process.exit(1);
  }
};

// Chạy script
seedAdmin(); 