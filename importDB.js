require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Import các model
const User = require('./models/User');
const Product = require('./models/Product');
const Category = require('./models/Category');
const Order = require('./models/Order');
const Review = require('./models/Review');
const Coupon = require('./models/Coupon');
const Cart = require('./models/Cart');

// Kết nối database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashionstore', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

// Đường dẫn thư mục backup
const backupDir = path.join(__dirname, 'backup');

// Hàm nhập dữ liệu từ một file JSON vào collection tương ứng
async function importCollectionFromFile(filename) {
  const collectionName = path.basename(filename, '.json');
  try {
    const filePath = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File ${filename} không tồn tại, bỏ qua`);
      return;
    }

    const jsonData = fs.readFileSync(filePath, 'utf8');
    let data = JSON.parse(jsonData);

    // Nếu file JSON rỗng hoặc không phải là mảng thì bỏ qua
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`ℹ️  File ${filename} rỗng hoặc không hợp lệ, bỏ qua`);
      return; 
    }

    // Chuyển đổi các string ID thành ObjectId
    data = data.map(item => {
      // Xử lý _id chính
      if (item._id && typeof item._id === 'string' && /^[0-9a-fA-F]{24}$/.test(item._id)) {
        item._id = new mongoose.Types.ObjectId(item._id);
      }
      
      // Xử lý các trường tham chiếu như category, user, v.v.
      if (item.category && typeof item.category === 'string' && /^[0-9a-fA-F]{24}$/.test(item.category)) {
        item.category = new mongoose.Types.ObjectId(item.category);
      }
      
      // Các trường tham chiếu khác nếu cần
      if (item.user && typeof item.user === 'string' && /^[0-9a-fA-F]{24}$/.test(item.user)) {
        item.user = new mongoose.Types.ObjectId(item.user);
      }
      
      return item;
    });

    const collection = db.collection(collectionName);

    // Xóa dữ liệu cũ
    await collection.deleteMany({});
    
    // Nhập dữ liệu mới
    await collection.insertMany(data);
    console.log(`✅ Đã nhập ${data.length} documents vào collection ${collectionName} thành công`);
  } catch (err) {
    // Xử lý lỗi JSON không hợp lệ
    if (err instanceof SyntaxError) {
      console.error(`❌ Lỗi khi đọc file ${filename}: JSON không hợp lệ.`);
    } else {
      console.error(`❌ Lỗi khi nhập collection ${collectionName} từ file ${filename}:`, err);
    }
  }
}

// Hàm nhập tất cả dữ liệu từ thư mục backup
async function importAll() {
  try {
    console.log('🔄 Đang nhập dữ liệu từ thư mục backup...');

    if (!fs.existsSync(backupDir)) {
      console.error(`❌ Thư mục backup (${backupDir}) không tồn tại.`);
      process.exit(1);
    }

    const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.json'));

    if (files.length === 0) {
      console.log('ℹ️ Không tìm thấy file .json nào trong thư mục backup.');
      process.exit(0);
    }

    console.log(`🔍 Tìm thấy các file backup: ${files.join(', ')}`);

    // **Lưu ý về thứ tự import:** Thứ tự import dựa trên thứ tự file trong thư mục.
    // Nếu có sự phụ thuộc chặt chẽ (ví dụ: Order phải có User tồn tại),
    // có thể cần logic phức tạp hơn hoặc import nhiều lần.
    for (const file of files) {
      await importCollectionFromFile(file);
    }

    console.log('✅ Hoàn thành nhập dữ liệu!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi nghiêm trọng khi nhập dữ liệu:', err);
    process.exit(1);
  }
}

// Chờ kết nối thành công rồi mới chạy import
db.on('error', (err) => {
  console.error('❌ Lỗi kết nối MongoDB:', err);
  process.exit(1);
});

db.once('open', () => {
  console.log('✅ Kết nối MongoDB thành công. Bắt đầu import...');
  importAll();
}); 