require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Kết nối database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashionstore', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

// Tạo thư mục backup nếu chưa tồn tại
const backupDir = path.join(__dirname, 'backup');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

// Hàm xuất tất cả các collection
async function exportAllCollections() {
  try {
    console.log('🔄 Đang xuất dữ liệu từ tất cả các collection...');

    // Lấy danh sách tất cả các collection
    const collections = await db.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name)
                                     .filter(name => !name.startsWith('system.')); // Lọc bỏ collection hệ thống

    console.log(`🔍 Tìm thấy các collection: ${collectionNames.join(', ')}`);

    for (const collectionName of collectionNames) {
      const filename = `${collectionName}.json`;
      try {
        const collection = db.collection(collectionName);
        const data = await collection.find({}).toArray();
        const jsonData = JSON.stringify(data, null, 2);
        fs.writeFileSync(path.join(backupDir, filename), jsonData);
        console.log(`✅ Đã xuất ${collectionName} (${data.length} documents) thành công`);
      } catch (err) {
        console.error(`❌ Lỗi khi xuất ${collectionName}:`, err);
      }
    }

    console.log('✅ Hoàn thành xuất dữ liệu!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi nghiêm trọng khi xuất dữ liệu:', err);
    process.exit(1);
  }
}

// Chờ kết nối thành công rồi mới chạy export
db.on('error', (err) => {
  console.error('❌ Lỗi kết nối MongoDB:', err);
  process.exit(1);
});

db.once('open', () => {
  console.log('✅ Kết nối MongoDB thành công. Bắt đầu export...');
  exportAllCollections();
}); 