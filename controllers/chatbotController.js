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

// Cache for frequently asked questions to reduce API calls
const responseCache = new Map();

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

    // Check cache first for fastest response
    if (responseCache.has(message.toLowerCase())) {
      return res.json({
        success: true,
        response: responseCache.get(message.toLowerCase()),
        source: 'cache'
      });
    }

    // Ưu tiên sử dụng HuggingFace API (theo yêu cầu của người dùng)
    if (apiKey) {
      try {
        const apiResponse = await getResponseFromAPI(message, apiKey);
        
        // Cache the response
        responseCache.set(message.toLowerCase(), apiResponse);
        
        return res.json({
          success: true,
          response: apiResponse,
          source: 'api'
        });
      } catch (apiError) {
        console.error('HuggingFace API error:', apiError.message);
        // Fall back to database if API fails
      }
    }

    // Nếu API bị lỗi, sử dụng database làm phương án dự phòng
    const dbResponse = await findResponseFromDatabase(message);
    
    if (dbResponse) {
      // Cache the response
      responseCache.set(message.toLowerCase(), dbResponse);
      
      return res.json({
        success: true,
        response: dbResponse,
        source: 'database'
      });
    }

    // Fallback nếu cả API và database đều thất bại
    const fallbackResp = fallbackResponse(message);
    responseCache.set(message.toLowerCase(), fallbackResp);
    
    return res.json({
      success: true,
      response: fallbackResp,
      source: 'fallback'
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

// Find response from database based on keywords
async function findResponseFromDatabase(message) {
  try {
    // Chuyển message thành chữ thường để tìm kiếm
    const lowercaseMessage = message.toLowerCase();
    
    // Tìm kiếm trong database với text search
    const dbResponses = await ChatbotResponse.find(
      { $text: { $search: lowercaseMessage } },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" }, priority: -1 })
    .limit(5);
    
    // Nếu có kết quả với score cao, trả về response
    if (dbResponses && dbResponses.length > 0 && dbResponses[0]._doc.score > 0.5) {
      return dbResponses[0].response;
    }
    
    // Nếu không có kết quả từ text search, thử tìm kiếm với từng từ khóa
    const keywords = lowercaseMessage.split(/\s+/);
    
    for (const keyword of keywords) {
      if (keyword.length < 3) continue; // Bỏ qua các từ quá ngắn
      
      const keywordResponses = await ChatbotResponse.find({
        keyword: { $regex: keyword, $options: 'i' }
      }).sort({ priority: -1 }).limit(1);
      
      if (keywordResponses && keywordResponses.length > 0) {
        return keywordResponses[0].response;
      }
    }
    
    // Kiểm tra nếu có từ khóa về sản phẩm cụ thể
    if (lowercaseMessage.includes('sản phẩm') || 
        lowercaseMessage.includes('hàng') || 
        lowercaseMessage.includes('quần') || 
        lowercaseMessage.includes('áo') || 
        lowercaseMessage.includes('đầm') || 
        lowercaseMessage.includes('phụ kiện')) {
      
      // Truy vấn sản phẩm từ database
      const products = await Product.find({})
        .sort({ createdAt: -1 })
        .limit(5);
      
      if (products && products.length > 0) {
        return `Một số sản phẩm mới nhất của chúng tôi: ${products.map(p => p.name).join(', ')}. Bạn có thể xem thêm tại mục Sản phẩm trên trang web.`;
      }
    }
    
    // Không tìm thấy kết quả phù hợp
    return null;
    
  } catch (error) {
    console.error('Database search error:', error);
    return null;
  }
}

// Get response from HuggingFace API
async function getResponseFromAPI(message, apiKey) {
  // Create prompt with context about the shop
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

// Fallback function if database and API both fail
function fallbackResponse(message) {
  // Simple keyword matching for essential queries
  const lowercaseMessage = message.toLowerCase();
  
  if (lowercaseMessage.includes('giờ mở cửa') || lowercaseMessage.includes('thời gian')) {
    return `Cửa hàng mở cửa: ${shopInfo.openingHours}`;
  }
  
  if (lowercaseMessage.includes('địa chỉ') || lowercaseMessage.includes('vị trí')) {
    return `Địa chỉ cửa hàng: ${shopInfo.location}`;
  }
  
  if (lowercaseMessage.includes('liên hệ') || lowercaseMessage.includes('số điện thoại') || lowercaseMessage.includes('email')) {
    return `Bạn có thể liên hệ với chúng tôi qua số điện thoại ${shopInfo.contactPhone} hoặc email ${shopInfo.contactEmail}`;
  }
  
  if (lowercaseMessage.includes('vận chuyển') || lowercaseMessage.includes('giao hàng')) {
    return shopInfo.shippingPolicy;
  }
  
  if (lowercaseMessage.includes('đổi trả') || lowercaseMessage.includes('hoàn tiền')) {
    return shopInfo.returnPolicy;
  }
  
  if (lowercaseMessage.includes('sản phẩm') || lowercaseMessage.includes('danh mục')) {
    return `Các danh mục sản phẩm của chúng tôi bao gồm: ${shopInfo.categories.join(', ')}`;
  }
  
  // Default response
  return 'Xin chào! Tôi có thể giúp gì cho bạn? Bạn có thể hỏi tôi về thông tin cửa hàng, sản phẩm, chính sách vận chuyển, đổi trả...';
} 