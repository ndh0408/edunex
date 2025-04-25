# Fashion Store - Cửa hàng thời trang trực tuyến

## Giới thiệu
Fashion Store là một ứng dụng thương mại điện tử (E-commerce) chuyên về thời trang, được xây dựng bằng Node.js và Express.js. Ứng dụng cung cấp một nền tảng mua sắm trực tuyến với đầy đủ các tính năng cần thiết cho cả người dùng và quản trị viên.

## Tính năng chính

### Cho người dùng
- Đăng ký và đăng nhập tài khoản
- Xem danh sách sản phẩm theo danh mục
- Tìm kiếm sản phẩm
- Thêm sản phẩm vào giỏ hàng
- Quản lý giỏ hàng
- Đặt hàng và thanh toán
- Xem lịch sử đơn hàng
- Đánh giá sản phẩm
- Áp dụng mã giảm giá

### Cho quản trị viên
- Quản lý sản phẩm (thêm, sửa, xóa)
- Quản lý danh mục sản phẩm
- Quản lý đơn hàng
- Quản lý người dùng
- Quản lý mã giảm giá
- Thống kê doanh thu
- Xuất báo cáo Excel

## Công nghệ sử dụng

### Backend
- Node.js
- Express.js
- MongoDB (Mongoose)
- Passport.js (Xác thực)
- Express-session (Quản lý phiên)
- Multer (Xử lý upload file)
- Nodemailer (Gửi email)
- Excel4node (Xuất Excel)
- Json2csv (Xuất CSV)

### Frontend
- EJS (Template Engine)
- Express-ejs-layouts
- Bootstrap
- JavaScript
- CSS

## Cài đặt và chạy dự án

### Yêu cầu hệ thống
- Node.js (phiên bản 14 trở lên)
- MongoDB
- NPM hoặc Yarn

### Các bước cài đặt

1. Clone dự án:
```bash
git clone [đường dẫn repository]
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file .env và cấu hình các biến môi trường:
```env
MONGODB_URI=mongodb://localhost:27017/fashionstore
PORT=3000
SESSION_SECRET=your_secret_key
NODE_ENV=development
```

4. Chạy seed data (tùy chọn):
```bash
npm run seed
```

5. Khởi động server:
```bash
npm start
```

Hoặc chạy ở chế độ development:
```bash
npm run dev
```

### Các lệnh khác

- **Khởi tạo dữ liệu mẫu:**
```bash
npm run seed
```
Lệnh này sẽ xóa dữ liệu cũ và tạo dữ liệu mẫu cho các collection (users, categories, products, coupons, orders, reviews).

- **Xuất dữ liệu database:**
```bash
npm run export
```
Lệnh này sẽ kết nối đến MongoDB, đọc dữ liệu từ tất cả các collection và lưu vào các file JSON tương ứng trong thư mục `backup`.

- **Nhập dữ liệu database:**
```bash
npm run import
```
Lệnh này sẽ đọc các file `.json` từ thư mục `backup`, xóa dữ liệu cũ trong các collection tương ứng và nhập dữ liệu mới từ file.
**Lưu ý:** Trước khi chạy lệnh này, đảm bảo bạn đã có thư mục `backup` với các file dữ liệu cần thiết. Thứ tự import phụ thuộc vào tên file.

## Cấu trúc thư mục
```