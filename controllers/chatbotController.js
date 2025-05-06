const axios = require('axios');
const ChatbotResponse = require('../models/ChatbotResponse');
const Product = require('../models/Product');
const Category = require('../models/Category');

// Shop information that will be used to customize responses
const shopInfo = {
  name: 'Fashion Store',
  description: 'Chúng tôi chuyên cung cấp các sản phẩm thời trang chất lượng cao',
  location: 'Thành phố Hồ Chí Minh, Việt Nam',
  openingHours: '9:00 - 21:00, Thứ Hai - Chủ Nhật',
  contactEmail: 'contact@fashionstore.com',
  contactPhone: '0123 456 789',
  shippingPolicy: 'Miễn phí vận chuyển cho đơn hàng trên 500.000 VND',
  returnPolicy: 'Đổi trả miễn phí trong vòng 7 ngày',
  categories: [
    'Áo nam', 'Quần nam', 'Áo nữ', 'Quần nữ', 'Đầm', 'Phụ kiện'
  ]
};

// Process the chat message and get response 
exports.processMessage = async (req, res) => {
  try {
    const { message, apiKey } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tin nhắn'
      });
    }

    // Get product information from database if relevant
    let productInfo = '';
    if (message.toLowerCase().includes('sản phẩm') || 
        message.toLowerCase().includes('hàng') || 
        message.toLowerCase().includes('quần') || 
        message.toLowerCase().includes('áo') || 
        message.toLowerCase().includes('đầm') || 
        message.toLowerCase().includes('phụ kiện')) {
      
      const products = await Product.find({})
        .sort({ createdAt: -1 })
        .limit(5);
      
      if (products && products.length > 0) {
        productInfo = `\nThông tin sản phẩm mới nhất: ${products.map(p => p.name).join(', ')}.`;
      }
    }

    // Get response from HuggingFace API
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API key is required'
      });
    }

    const apiResponse = await getResponseFromAPI(message, apiKey, productInfo);
    
    return res.json({
      success: true,
      response: apiResponse,
      source: 'api'
    });

  } catch (error) {
    console.error('Chatbot error:', error.message);
    
    if (error.response) {
      console.error('Error Response Data:', error.response.data);
      console.error('Error Response Status:', error.response.status);
    } else if (error.request) {
      console.error('Error Request:', error.request);
    }
    
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi xử lý tin nhắn',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get response from HuggingFace API
async function getResponseFromAPI(message, apiKey, productInfo = '') {
  // Create prompt with context about the shop and product info
  const prompt = `<|system|>
Bạn là trợ lý ảo của ${shopInfo.name}. ${shopInfo.description}. 
Thông tin cửa hàng: 
- Địa chỉ: ${shopInfo.location}
- Giờ mở cửa: ${shopInfo.openingHours}
- Email: ${shopInfo.contactEmail}
- Điện thoại: ${shopInfo.contactPhone}
- Chính sách vận chuyển: ${shopInfo.shippingPolicy}
- Chính sách đổi trả: ${shopInfo.returnPolicy}
- Danh mục sản phẩm: ${shopInfo.categories.join(', ')}
${productInfo}

Hãy trả lời đầy đủ và chi tiết. Luôn trả lời bằng tiếng Việt. Không đề cập đến việc bạn là AI, chỉ tập trung vào việc cung cấp thông tin về cửa hàng.
<|user|>
${message}
<|assistant|>`;

  // Call HuggingFace API
  const modelName = 'HuggingFaceH4/zephyr-7b-beta';
  console.log(`Gọi API đến model: ${modelName}`);
  
  const response = await axios({
    method: 'post',
    url: `https://api-inference.huggingface.co/models/${modelName}`,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    data: { 
      inputs: prompt,
      parameters: {
        max_new_tokens: 300,
        temperature: 0.7,
        top_p: 0.95,
        do_sample: true,
        return_full_text: false
      }
    },
    timeout: 60000 // 60 seconds timeout
  });

  // Extract the generated text
  if (response.data && response.data[0] && response.data[0].generated_text) {
    // Extract only the assistant's response (after the assistant tag)
    const fullText = response.data[0].generated_text;
    
    // Look for the assistant tag and extract everything after it
    const assistantTag = '<|assistant|>';
    const assistantTagIndex = fullText.indexOf(assistantTag);
    
    if (assistantTagIndex !== -1) {
      let botResponse = fullText.substring(assistantTagIndex + assistantTag.length).trim();
      // Clean up the response if needed
      botResponse = botResponse.replace(/<\|.*?\|>/g, '').trim();
      return botResponse;
    } else {
      return fullText.substring(prompt.length).trim().replace(/<\|.*?\|>/g, '').trim();
    }
  } 
  
  throw new Error('No valid response from API');
} 