const axios = require("axios");
const crypto = require("crypto");
const querystring = require("querystring");
const moment = require("moment");
const Order = require("../models/Order");

// ====================== PayPal Payment Methods ======================

// @desc    Create PayPal payment
// @route   GET /payment/paypal/create
exports.createPayPalPayment = async (req, res) => {
  try {
    const orderId = req.query.orderId;
    console.log(`[PayPal Create] Starting for Order ID: ${orderId}`);

    if (!orderId) {
      console.error('[PayPal Create] Error: Missing orderId');
      req.flash("error_msg", "ID đơn hàng không hợp lệ");
      return res.redirect("/users/orders");
    }

    const order = await Order.findById(orderId);

    if (!order) {
      console.error(`[PayPal Create] Error: Order not found for ID: ${orderId}`);
      req.flash("error_msg", "Không tìm thấy đơn hàng");
      return res.redirect("/users/orders");
    }
    console.log(`[PayPal Create] Found Order: ${order._id}, Total: ${order.totalAmount} VND`);

    // Check if order belongs to user
    if (order.user.toString() !== req.user._id.toString()) {
      req.flash("error_msg", "Bạn không có quyền truy cập đơn hàng này");
      return res.redirect("/users/orders");
    }

    // Check for PayPal Credentials
    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!paypalClientId || !paypalClientSecret) {
      console.error('[PayPal Create] Error: Missing PayPal credentials in .env file');
      req.flash("error_msg", "Lỗi cấu hình thanh toán PayPal. Vui lòng liên hệ quản trị viên.");
      return res.redirect(`/orders/${orderId}`); // Redirect back to order page
    }

    // Get access token from PayPal
    console.log('[PayPal Create] Getting Access Token...');
    const auth = Buffer.from(
      `${paypalClientId}:${paypalClientSecret}`,
    ).toString("base64");

    let tokenResponse;
    try {
      tokenResponse = await axios({
        method: "post",
        url: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: "grant_type=client_credentials",
      });
      console.log('[PayPal Create] Access Token Received.');
    } catch (tokenError) {
      console.error('[PayPal Create] Error getting Access Token:', tokenError.response ? tokenError.response.data : tokenError.message);
      throw new Error('Failed to get PayPal access token'); // Rethrow to be caught by outer catch
    }

    const accessToken = tokenResponse.data.access_token;

    // Prepare PayPal order data
    const amountInUSD = Math.round((order.totalAmount / 23000) * 100) / 100; // Use totalAmount
    if (amountInUSD < 0.01) {
        console.error(`[PayPal Create] Error: Calculated USD amount (${amountInUSD}) is too low for order ${orderId}`);
        req.flash("error_msg", "Số tiền đơn hàng quá nhỏ để xử lý qua PayPal.");
        return res.redirect(`/orders/${orderId}`);
    }
    
    const paypalOrderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order._id.toString(),
          description: `Thanh toán đơn hàng #${order.orderNumber || order._id.toString().substring(0, 8)}`,
          amount: {
            currency_code: "USD",
            value: amountInUSD.toFixed(2), // Ensure 2 decimal places
          },
        },
      ],
      application_context: {
        brand_name: "Fashion Store",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${req.protocol}://${req.get("host")}/payment/paypal/capture`,
        cancel_url: `${req.protocol}://${req.get("host")}/payment/paypal/cancel`,
      },
    };
    console.log('[PayPal Create] Creating PayPal Order with data:', JSON.stringify(paypalOrderData, null, 2));

    // Create PayPal order
    let createOrderResponse;
    try {
      createOrderResponse = await axios({
        method: "post",
        url: "https://api-m.sandbox.paypal.com/v2/checkout/orders",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        data: paypalOrderData,
      });
      console.log('[PayPal Create] PayPal Order Created, ID:', createOrderResponse.data.id);
    } catch (createError) {
      console.error('[PayPal Create] Error creating PayPal order:', createError.response ? createError.response.data : createError.message);
      throw new Error('Failed to create PayPal order'); // Rethrow
    }

    // Store PayPal order ID in session
    req.session.paypalOrderId = createOrderResponse.data.id;
    req.session.storeOrderId = order._id;
    console.log(`[PayPal Create] Stored IDs in session: PayPal=${req.session.paypalOrderId}, Store=${req.session.storeOrderId}`);

    // Redirect user to PayPal approval URL
    const approvalUrl = createOrderResponse.data.links.find(
      (link) => link.rel === "approve",
    )?.href; // Use optional chaining

    if (!approvalUrl) {
        console.error('[PayPal Create] Error: Could not find approval URL in PayPal response:', createOrderResponse.data);
        throw new Error('PayPal approval URL not found');
    }

    console.log(`[PayPal Create] Redirecting user to PayPal Approval URL: ${approvalUrl}`);
    res.redirect(approvalUrl);

  } catch (error) {
    // Log the consolidated error message
    console.error("PayPal create payment process failed:", error.message);
    // Use the specific error message if available, otherwise generic
    req.flash("error_msg", error.message || "Có lỗi xảy ra khi tạo thanh toán PayPal");
    // Attempt to redirect back to the order details page if possible
    const orderIdForRedirect = req.query.orderId || req.session.storeOrderId;
    if (orderIdForRedirect) {
      res.redirect(`/orders/${orderIdForRedirect}`);
    } else {
      res.redirect("/users/orders"); // Fallback redirect
    }
  }
};

// @desc    Capture PayPal payment after approval
// @route   GET /payment/paypal/capture
exports.capturePayPalPayment = async (req, res) => {
  try {
    console.log("PayPal callback received", req.query);
    
    const paypalOrderId = req.session.paypalOrderId;
    const storeOrderId = req.session.storeOrderId;

    console.log("Session data:", { paypalOrderId, storeOrderId });

    if (!paypalOrderId || !storeOrderId) {
      console.log("Missing PayPal order ID or store order ID");
      req.flash("error_msg", "Thông tin thanh toán không hợp lệ");
      return res.redirect("/users/orders");
    }

    // Get access token from PayPal
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
    ).toString("base64");

    const tokenResponse = await axios({
      method: "post",
      url: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "grant_type=client_credentials",
    });

    const accessToken = tokenResponse.data.access_token;
    console.log("Got PayPal access token");

    // Capture payment
    console.log("Attempting to capture payment for PayPal order:", paypalOrderId);
    const response = await axios({
      method: "post",
      url: `https://api-m.sandbox.paypal.com/v2/checkout/orders/${paypalOrderId}/capture`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      data: {} // Add empty JSON object body as recommended by PayPal
    });

    console.log("PayPal capture response:", response.data);

    if (response.data.status === "COMPLETED") {
      console.log("PayPal payment completed. Updating order...");
      // Update order in database
      const order = await Order.findById(storeOrderId);

      if (!order) {
        console.log("Order not found:", storeOrderId);
        req.flash("error_msg", "Không tìm thấy đơn hàng");
        return res.redirect("/users/orders");
      }

      console.log("Current order state:", order);
      
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentStatus = 'Đã thanh toán';
      order.paymentResult = {
        id: response.data.id,
        status: response.data.status,
        update_time: response.data.update_time,
        email_address: response.data.payer.email_address,
      };

      await order.save();
      console.log("Order updated successfully");

      // Clear session data
      req.session.paypalOrderId = null;
      req.session.storeOrderId = null;

      req.flash("success_msg", "Thanh toán thành công");
      console.log("Redirecting to:", `/orders/${storeOrderId}`);
      res.redirect(`/orders/${storeOrderId}`);
    } else {
      console.log("PayPal payment not completed:", response.data);
      req.flash("error_msg", "Thanh toán PayPal không thành công");
      res.redirect("/users/orders");
    }
  } catch (error) {
    console.error("PayPal capture payment error:", error);
    // Log more details from PayPal if available (especially for 4xx errors)
    if (error.response && error.response.data) {
      console.error("PayPal Error Details:", JSON.stringify(error.response.data, null, 2));
    }
    req.flash("error_msg", "Có lỗi xảy ra khi xử lý thanh toán PayPal");
    res.redirect("/users/orders");
  }
};

// @desc    Cancel PayPal payment
// @route   GET /payment/paypal/cancel
exports.cancelPayPalPayment = async (req, res) => {
  try {
    const storeOrderId = req.session.storeOrderId;

    // Clear session data
    req.session.paypalOrderId = null;
    req.session.storeOrderId = null;

    req.flash("error_msg", "Bạn đã hủy thanh toán PayPal");

    if (storeOrderId) {
      return res.redirect(`/orders/${storeOrderId}`);
    } else {
      return res.redirect("/users/orders");
    }
  } catch (error) {
    console.error("PayPal cancel payment error:", error);
    req.flash("error_msg", "Có lỗi xảy ra khi hủy thanh toán PayPal");
    res.redirect("/users/orders");
  }
};

// ====================== VNPay Payment Methods ======================

// @desc    Tạo thanh toán VNPay
// @route   GET /payment/vnpay/payment/:id
exports.createVNPayPayment = async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log('Creating VNPay payment for order:', orderId);
    
    if (!orderId) {
      req.flash('error_msg', 'Thiếu ID đơn hàng');
      return res.redirect('/users/orders');
    }
    
    // Kiểm tra đơn hàng tồn tại
    const order = await Order.findById(orderId);
    if (!order) {
      console.log('Order not found with ID:', orderId);
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/users/orders');
    }
    
    console.log('Found order:', order._id, 'Total price:', order.totalPrice);
    
    // Kiểm tra quyền truy cập
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      req.flash('error_msg', 'Không có quyền truy cập đơn hàng này');
      return res.redirect('/users/orders');
    }
    
    // Cấu hình VNPay - Sử dụng thông tin cung cấp bởi VNPay
    const vnp_Url = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const vnp_ReturnUrl = `${baseUrl}/payment/vnpay/return`;
    const vnp_TmnCode = 'KPHFOB2X'; // Mã website tại VNPay
    const vnp_HashSecret = 'XGSOVBKWANDZYVRTYCKKLUCMDAYJZVSG'; // Chuỗi bí mật
    
    console.log('VNPay configs:', { 
      vnp_Url, 
      vnp_ReturnUrl, 
      vnp_TmnCode: vnp_TmnCode ? 'Available' : 'Missing',
      vnp_HashSecret: vnp_HashSecret ? 'Available' : 'Missing'
    });
    
    // Tạo mã giao dịch theo định dạng YYYYMMDDHHmmss
    const createDate = moment().format('YYYYMMDDHHmmss');
    const orderId2Digits = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const txnRef = createDate + orderId2Digits;
    
    // Lấy IP người dùng
    const ipAddr = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress || 
                   req.connection.socket.remoteAddress || 
                   '127.0.0.1';
    
    // Tạo tham số thanh toán
    const tmnCode = vnp_TmnCode;
    const secretKey = vnp_HashSecret;
    const returnUrl = vnp_ReturnUrl;
    
    const locale = 'vn';
    const currCode = 'VND';
    const vnp_Params = {};
    
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = txnRef;
    vnp_Params['vnp_OrderInfo'] = `Thanh toan don hang ${order._id}`;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = Math.round(order.totalPrice * 100);
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    
    console.log('VNPay parameters:', vnp_Params);
    
    // Lưu mã giao dịch để đối chiếu khi xử lý kết quả
    if (!req.session.vnpayTxnRef) {
      req.session.vnpayTxnRef = {};
    }
    req.session.vnpayTxnRef[txnRef] = order._id.toString();
    console.log('Saved TxnRef in session:', txnRef, '→', order._id.toString());
    
    // Sắp xếp các tham số theo thứ tự alphabet và tạo chuỗi ký
    const sortedParams = {};
    const keys = Object.keys(vnp_Params).sort();
    keys.forEach(function(key) {
      sortedParams[key] = vnp_Params[key];
    });
    
    const querystring = require('qs');
    const signData = querystring.stringify(sortedParams, { encode: false });
    
    console.log('Sign data:', signData);
    
    // Tạo chữ ký HMAC-SHA512
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest('hex');
    
    console.log('Generated secure hash:', signed);
    
    // Thêm chữ ký vào tham số
    vnp_Params['vnp_SecureHash'] = signed;
    
    // Tạo URL thanh toán
    const paymentUrl = vnp_Url + '?' + querystring.stringify(vnp_Params, { encode: true });
    
    console.log('Final payment URL:', paymentUrl);
    
    // Chuyển hướng đến trang thanh toán VNPay
    return res.redirect(paymentUrl);
  } catch (error) {
    console.error('Lỗi tạo thanh toán VNPay:', error);
    req.flash('error_msg', 'Có lỗi xảy ra khi tạo thanh toán VNPay');
    return res.redirect('/users/orders');
  }
};

// @desc    Xử lý kết quả thanh toán VNPay
// @route   GET /payment/vnpay/return
exports.processVNPayPayment = async (req, res) => {
  try {
    console.log('VNPay return params:', req.query);
    
    // Lấy tham số từ VNPay trả về
    const vnp_Params = req.query;
    
    // Lấy chữ ký
    const secureHash = vnp_Params['vnp_SecureHash'];
    
    // Xóa chữ ký để kiểm tra
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];
    
    // Sắp xếp các tham số và tạo chuỗi ký
    const secretKey = 'XGSOVBKWANDZYVRTYCKKLUCMDAYJZVSG';
    const querystring = require('qs');
    
    const sortedParams = {};
    const keys = Object.keys(vnp_Params).sort();
    keys.forEach(function(key) {
      sortedParams[key] = vnp_Params[key];
    });
    
    const signData = querystring.stringify(sortedParams, { encode: false });
    
    console.log('Return sign data:', signData);
    
    // Tạo chữ ký với SHA-512 để kiểm tra
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest('hex');
    
    console.log('Generated secure hash for verification:', signed);
    console.log('Received secure hash:', secureHash);
    
    // Kiểm tra chữ ký
    if (secureHash === signed) {
      // Lấy mã giao dịch
      const txnRef = vnp_Params['vnp_TxnRef'];
      
      // Tìm ID đơn hàng từ session
      let orderId = null;
      if (req.session.vnpayTxnRef && req.session.vnpayTxnRef[txnRef]) {
        orderId = req.session.vnpayTxnRef[txnRef];
      }
      
      if (!orderId) {
        // Nếu không tìm thấy trong session, thử tìm từ vnp_OrderInfo
        const orderInfo = vnp_Params['vnp_OrderInfo'];
        const matches = orderInfo.match(/Thanh toan don hang ([a-zA-Z0-9]+)/);
        if (matches && matches[1]) {
          const orderPrefix = matches[1];
          const orders = await Order.find({
            _id: { $regex: new RegExp('^' + orderPrefix) }
          });
          
          if (orders && orders.length > 0) {
            orderId = orders[0]._id;
          }
        }
      }
      
      if (!orderId) {
        req.flash('error_msg', 'Không tìm thấy thông tin đơn hàng');
        return res.redirect('/users/orders');
      }
      
      // Tìm đơn hàng
      const order = await Order.findById(orderId);
      
      if (!order) {
        req.flash('error_msg', 'Không tìm thấy đơn hàng');
        return res.redirect('/users/orders');
      }
      
      // Kiểm tra kết quả thanh toán
      if (vnp_Params['vnp_ResponseCode'] === '00') {
        // Thanh toán thành công
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentStatus = 'Đã thanh toán';
        order.paymentResult = {
          id: vnp_Params['vnp_TransactionNo'],
          status: 'Thành công',
          update_time: new Date().toISOString()
        };
        
        await order.save();
        
        // Xóa thông tin session
        if (req.session.vnpayTxnRef && txnRef) {
          delete req.session.vnpayTxnRef[txnRef];
        }
        
        req.flash('success_msg', 'Thanh toán thành công');
        return res.redirect(`/orders/${order._id}`);
      } else {
        // Thanh toán thất bại
        const responseCode = vnp_Params['vnp_ResponseCode'];
        const errorMessage = getVNPayResponseMessage(responseCode);
        
        req.flash('error_msg', `Thanh toán không thành công: ${errorMessage}`);
        return res.redirect(`/orders/${order._id}`);
      }
    } else {
      req.flash('error_msg', 'Chữ ký không hợp lệ');
      return res.redirect('/users/orders');
    }
  } catch (error) {
    console.error('Lỗi xử lý kết quả thanh toán VNPay:', error);
    req.flash('error_msg', 'Có lỗi xảy ra khi xử lý kết quả thanh toán');
    return res.redirect('/users/orders');
  }
};

// ====================== Manual Payment Update ======================
// @desc    Manually update payment status
// @route   GET /payment/manual-update/:id
exports.manualPaymentUpdate = async (req, res) => {
  try {
    const orderId = req.params.id;
    
    if (!orderId) {
      req.flash('error_msg', 'ID đơn hàng không hợp lệ');
      return res.redirect('/users/orders');
    }
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      req.flash('error_msg', 'Không tìm thấy đơn hàng');
      return res.redirect('/users/orders');
    }
    
    // Check if order belongs to user
    if (order.user.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Bạn không có quyền truy cập đơn hàng này');
      return res.redirect('/users/orders');
    }
    
    // Update payment status
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentStatus = 'Đã thanh toán';
    order.paymentResult = {
      id: 'manual-update-' + Date.now(),
      status: 'Thành công',
      update_time: new Date().toISOString(),
      email_address: req.user.email
    };
    
    await order.save();
    
    req.flash('success_msg', 'Đã cập nhật trạng thái thanh toán thành công');
    res.redirect(`/orders/${orderId}`);
  } catch (error) {
    console.error('Manual payment update error:', error);
    req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật trạng thái thanh toán');
    res.redirect('/users/orders');
  }
};

// Helper function to get VNPay response message
function getVNPayResponseMessage(responseCode) {
  const messages = {
    '00': 'Giao dịch thành công',
    '01': 'Giao dịch đã tồn tại',
    '02': 'Merchant không hợp lệ',
    '03': 'Dữ liệu gửi sang không đúng định dạng',
    '04': 'Khởi tạo GD không thành công do Website đang bị tạm khóa',
    '05': 'Giao dịch không thành công do: Quý khách nhập sai mật khẩu thanh toán quá số lần quy định',
    '06': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực',
    '07': 'Giao dịch bị nghi ngờ gian lận',
    '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking',
    '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
    '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán',
    '12': 'Giao dịch không thành công do: Thẻ/Tài khoản bị khóa',
    '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
    '51': 'Giao dịch không thành công do: Tài khoản không đủ số dư để thực hiện giao dịch',
    '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày',
    '75': 'Ngân hàng thanh toán đang bảo trì',
    '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán nhiều lần',
    '99': 'Lỗi không xác định'
  };
  
  return messages[responseCode] || `Lỗi không xác định (Mã: ${responseCode})`;
} 