// seedAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Danh sách tài khoản cần khởi tạo
const accounts = [
  {
    name: 'Admin',
    email: 'admin@example.com',
    password: 'admin123',
    phone: '0123456789',
    address: '123 Đường ABC, Quận 1, TP.HCM',
    role: 'admin',
    isVerified: true
  },
  {
    name: 'Nguyễn Văn A',
    email: 'usera@example.com',
    password: 'userA123',
    phone: '0912345678',
    address: 'TP. Hồ Chí Minh',
    role: 'user',
    isVerified: true
  },
  {
    name: 'Trần Thị B',
    email: 'userb@example.com',
    password: 'userB123',
    phone: '0923456789',
    address: 'Đà Nẵng',
    role: 'user',
    isVerified: true
  },
  {
    name: 'Lê Văn C',
    email: 'userc@example.com',
    password: 'userC123',
    phone: '0934567890',
    address: 'Cần Thơ',
    role: 'user',
    isVerified: true
  }
];

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

// Tạo các tài khoản theo danh sách
const seedAccounts = async () => {
  for (const acct of accounts) {
    try {
      const exists = await User.findOne({ email: acct.email });
      if (exists) {
        console.log(`⚠️  Tài khoản ${acct.email} đã tồn tại, bỏ qua.`);
        continue;
      }
      const user = new User(acct);
      await user.save();
      console.log(`✅  Đã tạo tài khoản: ${acct.email} (${acct.role})`);
    } catch (err) {
      console.error(`❌  Lỗi tạo tài khoản ${acct.email}:`, err.message);
    }
  }
};

const seedAll = async () => {
  await connectDB();
  await seedAccounts();
  console.log('✅  Hoàn thành khởi tạo tất cả tài khoản');
  process.exit(0);
};

seedAll();
