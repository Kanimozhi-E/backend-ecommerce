const Product = require('../models/Product');
const Order = require('../models/Order');

class RecommendationService {
  /**
   * Filter rule: Active and in stock only
   */
  get baseQuery() {
    return { isActive: { $ne: false }, stock: { $gt: 0 } };
  }

  /**
   * Fallback popular products when user data is missing or scarce
   */
  async getPopularFallback(limit = 4, excludeIds = []) {
    const query = { ...this.baseQuery };
    if (excludeIds.length > 0) {
      query._id = { $nin: excludeIds };
    }
    return Product.find(query)
      .populate('category', 'name slug')
      .sort({ rating: -1, numReviews: -1, createdAt: -1 })
      .limit(limit);
  }

  /**
   * 1. Recommended for You (Personalized based on category, brand, tags, price range, browsing & purchase history)
   */
  async getRecommendedForYou(userId, viewedIds = [], limit = 4) {
    try {
      const interestCategories = new Set();
      const interestBrands = new Set();
      const interestTags = new Set();
      const excludeProductIds = new Set();

      const combinedViewedIds = (Array.isArray(viewedIds) ? viewedIds : [])
        .filter(id => id && String(id).match(/^[0-9a-fA-F]{24}$/))
        .map(id => id.toString());

      // 1. Analyze User Purchase History & MongoDB Browsing History (if logged in)
      if (userId) {
        const User = require('../models/User');
        const [userOrders, dbUser] = await Promise.all([
          Order.find({ user: userId, isPaid: true }).populate('orderItems.product'),
          User.findById(userId)
        ]);

        userOrders.forEach(order => {
          order.orderItems.forEach(item => {
            if (item.product) {
              excludeProductIds.add(item.product._id.toString());
              if (item.product.category) interestCategories.add(item.product.category.toString());
              if (item.product.brand) interestBrands.add(item.product.brand.toLowerCase());
              if (Array.isArray(item.product.tags)) {
                item.product.tags.forEach(t => interestTags.add(t.toLowerCase()));
              }
            }
          });
        });

        if (dbUser && Array.isArray(dbUser.browsingHistory)) {
          dbUser.browsingHistory.forEach(id => {
            if (id) combinedViewedIds.push(id.toString());
          });
        }
      }

      // 2. Analyze User Browsing History (from MongoDB + session / localStorage viewedIds e.g. browsed watches)
      const uniqueViewedIds = Array.from(new Set(combinedViewedIds));

      if (uniqueViewedIds.length > 0) {
        const viewedProducts = await Product.find({ _id: { $in: uniqueViewedIds } });
        viewedProducts.forEach(p => {
          if (p.category) interestCategories.add(p.category.toString());
          if (p.brand) interestBrands.add(p.brand.toLowerCase());
          if (Array.isArray(p.tags)) {
            p.tags.forEach(t => interestTags.add(t.toLowerCase()));
          }
        });
      }

      // If no browsing or purchase history exists, return popular fallback
      if (interestCategories.size === 0 && interestBrands.size === 0 && interestTags.size === 0) {
        return this.getPopularFallback(limit);
      }

      const query = {
        ...this.baseQuery,
        _id: { $nin: Array.from(excludeProductIds) },
        $or: [
          { category: { $in: Array.from(interestCategories) } },
          { brand: { $in: Array.from(interestBrands).map(b => new RegExp(b, 'i')) } },
          { tags: { $in: Array.from(interestTags).map(t => new RegExp(t, 'i')) } }
        ]
      };

      let recommended = await Product.find(query)
        .populate('category', 'name slug')
        .sort({ rating: -1, isFeatured: -1 })
        .limit(limit);

      // Fill with popular if recommendations are fewer than requested limit
      if (recommended.length < limit) {
        const existingIds = recommended.map(p => p._id.toString()).concat(Array.from(excludeProductIds));
        const fillProducts = await this.getPopularFallback(limit - recommended.length, existingIds);
        recommended = recommended.concat(fillProducts);
      }

      return recommended;
    } catch (err) {
      console.warn('[RecommendationService] RecommendedForYou error, using fallback:', err.message);
      return this.getPopularFallback(limit);
    }
  }

  /**
   * 2. Similar Products (Matching category, brand, tag overlap, price range ±30%)
   */
  async getSimilarProducts(productId, limit = 4) {
    try {
      if (!productId) return this.getPopularFallback(limit);

      const targetProduct = await Product.findById(productId);
      if (!targetProduct) return this.getPopularFallback(limit);

      const minPrice = targetProduct.price * 0.7;
      const maxPrice = targetProduct.price * 1.3;

      const query = {
        ...this.baseQuery,
        _id: { $ne: targetProduct._id },
        $or: [
          { category: targetProduct.category },
          { brand: targetProduct.brand ? new RegExp(targetProduct.brand, 'i') : null },
          { tags: { $in: (targetProduct.tags || []).map(t => new RegExp(t, 'i')) } }
        ],
        price: { $gte: minPrice, $lte: maxPrice }
      };

      let similar = await Product.find(query)
        .populate('category', 'name slug')
        .sort({ rating: -1 })
        .limit(limit);

      if (similar.length < limit) {
        const excludeIds = similar.map(p => p._id.toString()).concat([targetProduct._id.toString()]);
        const fill = await this.getPopularFallback(limit - similar.length, excludeIds);
        similar = similar.concat(fill);
      }

      return similar;
    } catch (err) {
      console.warn('[RecommendationService] SimilarProducts error:', err.message);
      return this.getPopularFallback(limit);
    }
  }

  /**
   * 3. Frequently Bought Together (Co-purchased items from order history or complementary categories)
   */
  async getFrequentlyBoughtTogether(productId, limit = 4) {
    try {
      if (!productId) return this.getPopularFallback(limit);

      const targetProduct = await Product.findById(productId);
      if (!targetProduct) return this.getPopularFallback(limit);

      // Find orders that contain the target product
      const coOrders = await Order.find({
        'orderItems.product': targetProduct._id
      }).populate('orderItems.product');

      const coCounts = {};
      coOrders.forEach(order => {
        order.orderItems.forEach(item => {
          if (item.product && item.product._id.toString() !== targetProduct._id.toString()) {
            const id = item.product._id.toString();
            coCounts[id] = (coCounts[id] || 0) + 1;
          }
        });
      });

      const topCoIds = Object.keys(coCounts).sort((a, b) => coCounts[b] - coCounts[a]);

      let coProducts = [];
      if (topCoIds.length > 0) {
        coProducts = await Product.find({
          ...this.baseQuery,
          _id: { $in: topCoIds }
        }).populate('category', 'name slug');
      }

      // If co-purchase history is empty, find items in complementary categories or tags
      if (coProducts.length < limit) {
        const excludeIds = coProducts.map(p => p._id.toString()).concat([targetProduct._id.toString()]);
        const complementaryQuery = {
          ...this.baseQuery,
          _id: { $nin: excludeIds },
          $or: [
            { category: { $ne: targetProduct.category } },
            { tags: { $in: (targetProduct.tags || []).map(t => new RegExp(t, 'i')) } }
          ]
        };

        const complementary = await Product.find(complementaryQuery)
          .populate('category', 'name slug')
          .sort({ rating: -1, numReviews: -1 })
          .limit(limit - coProducts.length);

        coProducts = coProducts.concat(complementary);
      }

      if (coProducts.length < limit) {
        const excludeIds = coProducts.map(p => p._id.toString()).concat([targetProduct._id.toString()]);
        const fill = await this.getPopularFallback(limit - coProducts.length, excludeIds);
        coProducts = coProducts.concat(fill);
      }

      return coProducts;
    } catch (err) {
      console.warn('[RecommendationService] FrequentlyBoughtTogether error:', err.message);
      return this.getPopularFallback(limit);
    }
  }

  /**
   * 4. Recently Viewed Products (Filter active/in-stock for given viewed IDs)
   */
  async getRecentlyViewed(productIds = [], limit = 6) {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return [];
      }

      const validIds = productIds.filter(id => id && String(id).match(/^[0-9a-fA-F]{24}$/));
      if (validIds.length === 0) return [];

      const products = await Product.find({
        ...this.baseQuery,
        _id: { $in: validIds }
      }).populate('category', 'name slug');

      // Preserve recency order from input array
      const productMap = {};
      products.forEach(p => (productMap[p._id.toString()] = p));

      return validIds
        .map(id => productMap[id])
        .filter(Boolean)
        .slice(0, limit);
    } catch (err) {
      console.warn('[RecommendationService] RecentlyViewed error:', err.message);
      return [];
    }
  }
}

module.exports = new RecommendationService();
