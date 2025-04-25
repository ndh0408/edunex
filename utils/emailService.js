const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send email
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.subject - Email subject
 * @param {String} options.html - Email HTML content
 */
const sendEmail = async (options) => {
  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'Fashion Store'} <${process.env.EMAIL_FROM || 'noreply@fashionstore.com'}>`,
    to: options.to,
    subject: options.subject,
    html: options.html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Send password reset email
 * @param {String} to - Recipient email
 * @param {String} resetToken - Reset token
 * @param {String} name - Recipient name
 */
const sendPasswordResetEmail = async (to, resetToken, name) => {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/users/reset-password/${resetToken}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Xin chào ${name || 'Thành viên'},</h2>
      <p>Bạn đã yêu cầu đặt lại mật khẩu tài khoản của mình.</p>
      <p>Vui lòng nhấp vào liên kết bên dưới để đặt lại mật khẩu của bạn:</p>
      <p style="margin: 20px 0;">
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Đặt lại mật khẩu</a>
      </p>
      <p>Hoặc sao chép và dán liên kết này vào trình duyệt của bạn:</p>
      <p style="word-break: break-all; color: #0066cc;">${resetUrl}</p>
      <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>
      <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
      <p>Trân trọng,<br>Đội ngũ Fashion Store</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: 'Yêu cầu đặt lại mật khẩu',
    html
  });
};

/**
 * Send email verification
 * @param {String} to - Recipient email
 * @param {String} verificationToken - Verification token
 * @param {String} name - Recipient name
 */
const sendVerificationEmail = async (to, verificationToken, name) => {
  const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/users/verify/${verificationToken}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Xin chào ${name || 'Thành viên'},</h2>
      <p>Cảm ơn bạn đã đăng ký tài khoản tại Fashion Store.</p>
      <p>Vui lòng nhấp vào liên kết bên dưới để xác thực tài khoản của bạn:</p>
      <p style="margin: 20px 0;">
        <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Xác thực tài khoản</a>
      </p>
      <p>Hoặc sao chép và dán liên kết này vào trình duyệt của bạn:</p>
      <p style="word-break: break-all; color: #0066cc;">${verificationUrl}</p>
      <p>Liên kết này sẽ hết hạn sau 24 giờ.</p>
      <p>Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email này.</p>
      <p>Trân trọng,<br>Đội ngũ Fashion Store</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: 'Xác thực tài khoản',
    html
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail
}; 