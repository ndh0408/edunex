# Fashion Store - Website Thương Mại Điện Tử

Một website bán hàng thời trang hoàn chỉnh được xây dựng bằng Node.js, Express và MongoDB.

## Tính Năng

- Đăng nhập và phân quyền người dùng
- Danh mục sản phẩm với chức năng tìm kiếm
- Giỏ hàng và quy trình thanh toán
- Hồ sơ người dùng với lịch sử đơn hàng
- Bảng điều khiển admin để quản lý sản phẩm, đơn hàng, người dùng, v.v.
- Thiết kế responsive cho mọi thiết bị
- Chức năng danh sách yêu thích
- Hệ thống mã giảm giá

## Yêu Cầu Hệ Thống

- Node.js (v14+)
- MongoDB
- NPM hoặc Yarn

## Cài Đặt

1. Clone dự án:
```
git clone https://github.com/username/fashion-store.git
cd fashion-store
```

2. Cài đặt các thư viện:
```
npm install
```

3. Tạo file `.env` trong thư mục gốc với các biến môi trường sau:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/edunex
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
```

4. Thêm hình ảnh mẫu:
   - Đặt hình ảnh sản phẩm của bạn vào thư mục `demo-images`
   - Script seed sẽ tự động sao chép các hình ảnh này vào thư mục public/uploads

5. Khởi tạo dữ liệu mẫu:
```
node seed.js
```

6. Khởi động ứng dụng:
```
npm start
```

7. Truy cập ứng dụng:
   - Website: http://localhost:3000
   - Trang quản trị: http://localhost:3000/admin

## Tài Khoản Mặc Định

Sau khi chạy script seed, các tài khoản sau sẽ được tạo:

- Admin:
  - Email: admin@example.com
  - Mật khẩu: admin123

- Người dùng thường:
  - Email: user@example.com
  - Mật khẩu: user123

## Công Nghệ Sử Dụng

- Node.js & Express.js
- MongoDB & Mongoose
- Template EJS
- Bootstrap 5
- Font Awesome
- Xác thực JWT
- Chart.js cho phân tích dữ liệu

## Cấu Trúc Dự Án

```
fashion-store/
├── config/          # File cấu hình
├── controllers/     # Controller xử lý route
├── middlewares/     # Middleware tùy chỉnh
├── models/          # Mongoose models
├── public/          # File tĩnh
│   ├── css/         # File CSS
│   ├── js/          # File JavaScript
│   ├── uploads/     # File upload
├── routes/          # Route Express
├── views/           # Template EJS
├── .env             # Biến môi trường
├── app.js           # Cài đặt Express
├── seed.js          # Script khởi tạo dữ liệu
└── package.json
```

## Giấy Phép

Dự án này được cấp phép theo Giấy phép MIT - xem file LICENSE để biết thêm chi tiết.

## Công Nhận

- [Bootstrap](https://getbootstrap.com/)
- [Font Awesome](https://fontawesome.com/)
- [Chart.js](https://www.chartjs.org/)
- [EJS](https://ejs.co/) 