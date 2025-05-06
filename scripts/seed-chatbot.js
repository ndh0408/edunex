require('dotenv').config();
const mongoose = require('mongoose');
const ChatbotResponse = require('../models/ChatbotResponse');

// Kết nối database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashionstore', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});

// Dữ liệu mẫu
const sampleData = [
  // Thông tin chung
  {
    keyword: 'xin chào',
    response: 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay?',
    category: 'general',
    priority: 10
  },
  {
    keyword: 'tạm biệt',
    response: 'Cảm ơn bạn đã liên hệ. Chúc bạn một ngày tốt lành!',
    category: 'general',
    priority: 10
  },
  {
    keyword: 'giờ mở cửa',
    response: 'Cửa hàng chúng tôi mở cửa từ 9:00 - 21:00, Thứ Hai - Chủ Nhật.',
    category: 'general',
    priority: 5
  },
  {
    keyword: 'địa chỉ',
    response: 'Địa chỉ cửa hàng: Thành phố Hồ Chí Minh, Việt Nam.',
    category: 'general',
    priority: 5
  },
  {
    keyword: 'liên hệ',
    response: 'Bạn có thể liên hệ với chúng tôi qua số điện thoại 0123 456 789 hoặc email contact@fashionstore.com',
    category: 'general',
    priority: 5
  },

  // Sản phẩm
  {
    keyword: 'sản phẩm',
    response: 'Chúng tôi cung cấp các sản phẩm thời trang như: Áo nam, Quần nam, Áo nữ, Quần nữ, Đầm, Phụ kiện.',
    category: 'product',
    priority: 5
  },
  {
    keyword: 'áo nam',
    response: 'Chúng tôi có nhiều loại áo nam như áo sơ mi, áo thun, áo khoác. Bạn có thể xem tại mục "Sản phẩm > Áo nam" trên trang web.',
    category: 'product',
    priority: 5
  },
  {
    keyword: 'quần nam',
    response: 'Chúng tôi có nhiều loại quần nam như quần jeans, quần kaki, quần short. Bạn có thể xem tại mục "Sản phẩm > Quần nam" trên trang web.',
    category: 'product',
    priority: 5
  },
  {
    keyword: 'áo nữ',
    response: 'Chúng tôi có nhiều loại áo nữ như áo sơ mi, áo thun, áo khoác. Bạn có thể xem tại mục "Sản phẩm > Áo nữ" trên trang web.',
    category: 'product',
    priority: 5
  },
  {
    keyword: 'quần nữ',
    response: 'Chúng tôi có nhiều loại quần nữ như quần jeans, quần kaki, quần short. Bạn có thể xem tại mục "Sản phẩm > Quần nữ" trên trang web.',
    category: 'product',
    priority: 5
  },
  {
    keyword: 'đầm',
    response: 'Chúng tôi có nhiều loại đầm như đầm dự tiệc, đầm công sở, đầm dạo phố. Bạn có thể xem tại mục "Sản phẩm > Đầm" trên trang web.',
    category: 'product',
    priority: 5
  },
  {
    keyword: 'phụ kiện',
    response: 'Chúng tôi có nhiều loại phụ kiện như túi xách, nón, dây lưng, kính mát. Bạn có thể xem tại mục "Sản phẩm > Phụ kiện" trên trang web.',
    category: 'product',
    priority: 5
  },
  {
    keyword: 'giá',
    response: 'Giá sản phẩm của chúng tôi rất cạnh tranh. Bạn có thể xem chi tiết giá từng sản phẩm trên trang web của chúng tôi.',
    category: 'product',
    priority: 3
  },
  {
    keyword: 'khuyến mãi',
    response: 'Hiện tại chúng tôi đang có nhiều chương trình khuyến mãi hấp dẫn. Vui lòng truy cập mục "Khuyến mãi" để biết thêm chi tiết.',
    category: 'product',
    priority: 3
  },

  // Vận chuyển
  {
    keyword: 'vận chuyển',
    response: 'Chúng tôi áp dụng chính sách: Miễn phí vận chuyển cho đơn hàng trên 500.000 VND.',
    category: 'shipping',
    priority: 5
  },
  {
    keyword: 'phí giao hàng',
    response: 'Phí giao hàng thông thường là 30.000 VND. Miễn phí giao hàng cho đơn hàng từ 500.000 VND.',
    category: 'shipping',
    priority: 5
  },
  {
    keyword: 'thời gian giao hàng',
    response: 'Thời gian giao hàng thông thường là 2-3 ngày đối với khu vực nội thành và 3-5 ngày đối với khu vực tỉnh.',
    category: 'shipping',
    priority: 4
  },

  // Thanh toán
  {
    keyword: 'thanh toán',
    response: 'Chúng tôi chấp nhận nhiều hình thức thanh toán: COD (thanh toán khi nhận hàng), chuyển khoản ngân hàng, và các ví điện tử như Momo, ZaloPay.',
    category: 'payment',
    priority: 5
  },
  {
    keyword: 'cod',
    response: 'Bạn có thể chọn phương thức thanh toán COD (Cash On Delivery) - thanh toán khi nhận hàng.',
    category: 'payment',
    priority: 4
  },
  {
    keyword: 'chuyển khoản',
    response: 'Bạn có thể thanh toán bằng hình thức chuyển khoản. Thông tin tài khoản sẽ được gửi qua email sau khi bạn đặt hàng.',
    category: 'payment',
    priority: 4
  },

  // Đổi trả
  {
    keyword: 'đổi trả',
    response: 'Chính sách đổi trả: Đổi trả miễn phí trong vòng 7 ngày kể từ ngày nhận hàng.',
    category: 'return',
    priority: 5
  },
  {
    keyword: 'hoàn tiền',
    response: 'Chúng tôi sẽ hoàn tiền trong vòng 3-5 ngày làm việc sau khi nhận được sản phẩm trả lại.',
    category: 'return',
    priority: 4
  },
  {
    keyword: 'lỗi sản phẩm',
    response: 'Nếu sản phẩm bị lỗi, vui lòng chụp ảnh và liên hệ với chúng tôi qua số điện thoại 0123 456 789 hoặc email contact@fashionstore.com.',
    category: 'return',
    priority: 4
  },

  // Tài khoản
  {
    keyword: 'đăng ký',
    response: 'Bạn có thể đăng ký tài khoản bằng cách nhấp vào nút "Đăng ký" ở góc trên bên phải trang web.',
    category: 'account',
    priority: 4
  },
  {
    keyword: 'đăng nhập',
    response: 'Bạn có thể đăng nhập bằng cách nhấp vào nút "Đăng nhập" ở góc trên bên phải trang web.',
    category: 'account',
    priority: 4
  },
  {
    keyword: 'quên mật khẩu',
    response: 'Nếu bạn quên mật khẩu, vui lòng nhấp vào liên kết "Quên mật khẩu" trên trang đăng nhập và làm theo hướng dẫn.',
    category: 'account',
    priority: 4
  }
];

// Thêm dữ liệu vào database
const seedDatabase = async () => {
  try {
    // Xóa dữ liệu cũ
    await ChatbotResponse.deleteMany({});
    console.log('Đã xóa dữ liệu cũ');

    // Thêm dữ liệu mới
    await ChatbotResponse.insertMany(sampleData);
    console.log(`Đã thêm ${sampleData.length} mục dữ liệu vào database`);

    // Kết thúc
    mongoose.connection.close();
    console.log('Kết nối database đã đóng');
  } catch (error) {
    console.error('Lỗi khi thêm dữ liệu:', error);
    mongoose.connection.close();
    process.exit(1);
  }
};

// Chạy script
seedDatabase(); 