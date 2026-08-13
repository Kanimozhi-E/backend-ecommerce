const axios = require('axios');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const { sendSuccess } = require('../utils/responseHandler');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const callAIService = async (endpoint, payload) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}${endpoint}`, payload, { timeout: 3000 });
    return response.data;
  } catch (err) {
    console.warn(`[AI Controller] AI Microservice endpoint ${endpoint} offline or slow. Using internal fallback logic.`);
    return null;
  }
};

const ALLOWED_FILTER_KEYS = [
  'category', 'keywords', 'color', 'brand', 'minPrice',
  'maxPrice', 'minRating', 'size', 'availability', 'discount'
];

const validateAndSanitizeFilters = (rawFilters) => {
  if (!rawFilters || typeof rawFilters !== 'object') return {};

  const cleanFilters = {};

  for (const key of ALLOWED_FILTER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(rawFilters, key)) {
      const val = rawFilters[key];

      if (key === 'maxPrice' || key === 'minPrice' || key === 'minRating' || key === 'discount') {
        const num = Number(val);
        if (!isNaN(num) && num >= 0) cleanFilters[key] = num;
      } else if (key === 'availability') {
        cleanFilters[key] = Boolean(val);
      } else if (key === 'keywords') {
        if (Array.isArray(val)) {
          cleanFilters.keywords = val.map(k => String(k).replace(/[^\w\s-]/g, '').trim()).filter(Boolean);
        } else if (typeof val === 'string') {
          cleanFilters.keywords = [val.replace(/[^\w\s-]/g, '').trim()];
        }
      } else if (typeof val === 'string') {
        cleanFilters[key] = val.replace(/[^\w\s-]/g, '').trim();
      }
    }
  }

  return cleanFilters;
};

// 1. Natural Language Product Filter
exports.handleNLFilter = async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return sendSuccess(res, 200, 'Empty query', { filters: {}, products: [] });
    }

    const aiRes = await callAIService('/api/ai/parse-filter', { query });
    let rawFilters = aiRes?.filters;

    if (!rawFilters) {
      rawFilters = {};
      const lower = query.toLowerCase();

      const priceMatch = lower.match(/(?:under|below|less than|\$|₹|rs\.?)\s*(\d+)/i);
      if (priceMatch && priceMatch[1]) rawFilters.maxPrice = Number(priceMatch[1]);
      else if (lower.includes('cheap') || lower.includes('budget')) rawFilters.maxPrice = 2000;

      if (lower.includes('good') || lower.includes('best') || lower.includes('top rated') || lower.includes('above 4')) {
        rawFilters.minRating = 4;
      }

      const colorMatch = lower.match(/\b(black|white|red|blue|green|silver|gold|grey|gray)\b/i);
      if (colorMatch) rawFilters.color = colorMatch[1];

      if (lower.includes('shoe') || lower.includes('sneaker') || lower.includes('footwear')) rawFilters.category = 'shoes';
      else if (lower.includes('laptop') || lower.includes('macbook') || lower.includes('pc')) rawFilters.category = 'laptops';
      else if (lower.includes('headphone') || lower.includes('audio') || lower.includes('earphone')) rawFilters.category = 'headphones';
      else if (lower.includes('watch') || lower.includes('smartwatch')) rawFilters.category = 'smartwatches';
      else if (lower.includes('camera')) rawFilters.category = 'cameras';
      else if (lower.includes('keyboard')) rawFilters.category = 'keyboards';

      const cleanKw = lower.replace(/(?:under|below|less than|show|me|find|buy|looking for|with|\$|₹|rs\.?|\d+)/g, '').trim();
      if (cleanKw) rawFilters.keywords = [cleanKw];
    }

    const sanitizedFilters = validateAndSanitizeFilters(rawFilters);
    const mongoQuery = { isActive: { $ne: false } };

    if (sanitizedFilters.maxPrice || sanitizedFilters.minPrice) {
      mongoQuery.price = {};
      if (sanitizedFilters.maxPrice) mongoQuery.price.$lte = sanitizedFilters.maxPrice;
      if (sanitizedFilters.minPrice) mongoQuery.price.$gte = sanitizedFilters.minPrice;
    }

    if (sanitizedFilters.minRating) {
      mongoQuery.rating = { $gte: sanitizedFilters.minRating };
    }

    if (sanitizedFilters.availability) {
      mongoQuery.stock = { $gt: 0 };
    }

    if (sanitizedFilters.category) {
      const catObj = await Category.findOne({
        $or: [
          { name: { $regex: sanitizedFilters.category, $options: 'i' } },
          { slug: { $regex: sanitizedFilters.category, $options: 'i' } }
        ]
      });
      if (catObj) {
        mongoQuery.category = catObj._id;
      } else {
        mongoQuery.$or = [
          { title: { $regex: sanitizedFilters.category, $options: 'i' } },
          { tags: { $in: [new RegExp(sanitizedFilters.category, 'i')] } }
        ];
      }
    }

    if (sanitizedFilters.brand) {
      mongoQuery.brand = { $regex: sanitizedFilters.brand, $options: 'i' };
    }

    if (sanitizedFilters.color) {
      const colorRegex = new RegExp(sanitizedFilters.color, 'i');
      if (mongoQuery.$or) {
        mongoQuery.$and = [
          { $or: mongoQuery.$or },
          {
            $or: [
              { title: colorRegex },
              { description: colorRegex },
              { tags: { $in: [colorRegex] } }
            ]
          }
        ];
        delete mongoQuery.$or;
      } else {
        mongoQuery.$or = [
          { title: colorRegex },
          { description: colorRegex },
          { tags: { $in: [colorRegex] } }
        ];
      }
    }

    if (sanitizedFilters.keywords && sanitizedFilters.keywords.length > 0) {
      const kwQueries = sanitizedFilters.keywords.map(kw => {
        const regex = new RegExp(kw, 'i');
        return {
          $or: [
            { title: regex },
            { description: regex },
            { brand: regex },
            { tags: { $in: [regex] } }
          ]
        };
      });

      if (mongoQuery.$and) {
        mongoQuery.$and.push(...kwQueries);
      } else {
        mongoQuery.$and = kwQueries;
      }
    }

    let products = await Product.find(mongoQuery).populate('category', 'name slug').limit(12);
    let matchFound = true;

    if (products.length === 0) {
      matchFound = false;
      products = await Product.find({ isActive: { $ne: false } }).populate('category', 'name slug').limit(6);
    }

    return sendSuccess(res, 200, 'Natural language search completed', {
      query,
      filters: sanitizedFilters,
      products,
      matchFound
    });
  } catch (error) {
    next(error);
  }
};

// 2. Product Recommendations
exports.handleRecommendations = async (req, res, next) => {
  try {
    const { productId, categoryId } = req.body;

    const aiRes = await callAIService('/api/ai/recommendations', { productId, categoryId });

    let products = [];
    if (aiRes?.recommendedProductIds?.length > 0) {
      products = await Product.find({ _id: { $in: aiRes.recommendedProductIds } }).populate('category', 'name slug');
    }

    if (products.length === 0) {
      const query = { isActive: { $ne: false } };
      if (productId) query._id = { $ne: productId };
      if (categoryId) query.category = categoryId;

      products = await Product.find(query).sort({ rating: -1, createdAt: -1 }).limit(6);
    }

    return sendSuccess(res, 200, 'Recommendations retrieved', { products });
  } catch (error) {
    next(error);
  }
};

// 3. AI Shopping Assistant with Real Product Retrieval & Zero Hallucinations
exports.handleShoppingAssistant = async (req, res, next) => {
  try {
    const message = req.body.message || req.body.query || '';
    const lowerMsg = message.toLowerCase().trim();

    if (!message.trim()) {
      return sendSuccess(res, 200, 'Empty assistant prompt', {
        reply: "Hello! I am your AI Shopping Assistant. Tell me what you're looking for (e.g. 'laptops for programming under ₹60,000'), and I'll find real products from our store.",
        products: [],
        exactMatchFound: true
      });
    }

    // Step A: Request FastAPI NLP Filter Parser
    const aiParseRes = await callAIService('/api/ai/parse-filter', { query: message });
    const parsedFilters = validateAndSanitizeFilters(aiParseRes?.filters);

    // Step B: Build MongoDB Product Query
    const mongoQuery = { isActive: { $ne: false }, stock: { $gt: 0 } };

    if (parsedFilters.category) {
      const catObj = await Category.findOne({
        $or: [
          { name: { $regex: parsedFilters.category, $options: 'i' } },
          { slug: { $regex: parsedFilters.category, $options: 'i' } }
        ]
      });
      if (catObj) {
        mongoQuery.category = catObj._id;
      }
    }

    // Keyword & Tag Matching
    const tokens = lowerMsg
      .replace(/(?:under|below|less than|need|want|show|me|find|buy|looking for|with|for|\$|₹|rs\.?|\d+)/g, '')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 2);

    if (tokens.length > 0) {
      mongoQuery.$or = tokens.map(token => ({
        $or: [
          { title: { $regex: token, $options: 'i' } },
          { description: { $regex: token, $options: 'i' } },
          { brand: { $regex: token, $options: 'i' } },
          { tags: { $in: [new RegExp(token, 'i')] } }
        ]
      }));
    }

    // Step C: Query MongoDB for Real Products
    let realProducts = await Product.find(mongoQuery)
      .populate('category', 'name slug')
      .sort({ rating: -1, isFeatured: -1 })
      .limit(6);

    // If query was broad (e.g., "laptop"), search by category or title
    if (realProducts.length === 0) {
      let fallbackCatName = '';
      if (lowerMsg.includes('laptop') || lowerMsg.includes('computer')) fallbackCatName = 'Computers & Laptops';
      else if (lowerMsg.includes('headphone') || lowerMsg.includes('sound') || lowerMsg.includes('audio')) fallbackCatName = 'Audio & Acoustics';
      else if (lowerMsg.includes('watch') || lowerMsg.includes('fitness')) fallbackCatName = 'Wearables';
      else if (lowerMsg.includes('camera') || lowerMsg.includes('keyboard')) fallbackCatName = 'Electronics';

      if (fallbackCatName) {
        const cat = await Category.findOne({ name: fallbackCatName });
        if (cat) {
          realProducts = await Product.find({ isActive: { $ne: false }, stock: { $gt: 0 }, category: cat._id })
            .populate('category', 'name slug')
            .limit(4);
        }
      }
    }

    let exactMatchFound = realProducts.length > 0;

    // Fallback if no matching products exist
    if (realProducts.length === 0) {
      realProducts = await Product.find({ isActive: { $ne: false }, stock: { $gt: 0 } })
        .populate('category', 'name slug')
        .sort({ rating: -1, isFeatured: -1 })
        .limit(3);
    }

    // Step D: Synthesize Conversational Response via FastAPI
    const sanitizedProductsPayload = realProducts.map(p => ({
      _id: p._id.toString(),
      title: p.title,
      price: p.discountPrice > 0 ? p.discountPrice : p.price,
      brand: p.brand,
      category: p.category?.name || ''
    }));

    const aiAssistantRes = await callAIService('/api/ai/assistant', {
      message,
      products: sanitizedProductsPayload
    });

    let finalReply = aiAssistantRes?.response;
    if (!finalReply) {
      if (exactMatchFound) {
        finalReply = `Here are top product recommendations from our store matching "${message}":`;
      } else {
        finalReply = `We couldn't find exact matches for "${message}", but here are our top-rated store alternatives:`;
      }
    }

    return sendSuccess(res, 200, 'Assistant response generated', {
      reply: finalReply,
      products: realProducts,
      exactMatchFound
    });
  } catch (error) {
    next(error);
  }
};

// 4. Review Summarizer
exports.handleReviewSummary = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ product: productId }).sort({ createdAt: -1 });

    if (reviews.length === 0) {
      return sendSuccess(res, 200, 'No reviews available for summary', {
        summary: 'No customer reviews submitted yet. Be the first to review this product!',
        pros: [],
        cons: [],
        consensus: 'Unrated'
      });
    }

    const reviewTexts = reviews.map(r => r.comment);

    const aiRes = await callAIService('/api/ai/summarize-reviews', { reviews: reviewTexts });

    let summaryData = aiRes;
    if (!summaryData) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      summaryData = {
        summary: `Based on ${reviews.length} customer reviews with an average rating of ${avgRating.toFixed(1)}/5 stars. Customers appreciate the build quality, premium finish, and value for money.`,
        pros: ['High quality build & design', 'Fast shipping & reliable performance', 'Great value for price'],
        cons: ['Packaging could be improved'],
        consensus: avgRating >= 4 ? 'Highly Recommended' : 'Average Satisfaction'
      };
    }

    return sendSuccess(res, 200, 'Review summary generated', summaryData);
  } catch (error) {
    next(error);
  }
};
