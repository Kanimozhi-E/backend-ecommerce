const recommendationService = require('../services/recommendationService');
const { sendSuccess } = require('../utils/responseHandler');

exports.getRecommendedForYou = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const limit = parseInt(req.query.limit, 10) || 4;
    const viewedIds = req.query.viewedIds ? req.query.viewedIds.split(',') : [];

    const products = await recommendationService.getRecommendedForYou(userId, viewedIds, limit);
    return sendSuccess(res, 200, 'Recommended for you retrieved', { products });
  } catch (error) {
    next(error);
  }
};

exports.getSimilarProducts = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 4;
    const products = await recommendationService.getSimilarProducts(productId, limit);
    return sendSuccess(res, 200, 'Similar products retrieved', { products });
  } catch (error) {
    next(error);
  }
};

exports.getFrequentlyBoughtTogether = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 4;
    const products = await recommendationService.getFrequentlyBoughtTogether(productId, limit);
    return sendSuccess(res, 200, 'Frequently bought together products retrieved', { products });
  } catch (error) {
    next(error);
  }
};

exports.getRecentlyViewed = async (req, res, next) => {
  try {
    const ids = req.query.ids ? req.query.ids.split(',') : [];
    const limit = parseInt(req.query.limit, 10) || 6;
    const products = await recommendationService.getRecentlyViewed(ids, limit);
    return sendSuccess(res, 200, 'Recently viewed products retrieved', { products });
  } catch (error) {
    next(error);
  }
};
