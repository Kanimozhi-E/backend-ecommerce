const express = require('express');
const router = express.Router();
const {
  getRecommendedForYou,
  getSimilarProducts,
  getFrequentlyBoughtTogether,
  getRecentlyViewed
} = require('../controllers/recommendationController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.get('/recommended-for-you', optionalAuth, getRecommendedForYou);
router.get('/similar/:productId', getSimilarProducts);
router.get('/frequently-bought-together/:productId', getFrequentlyBoughtTogether);
router.get('/recently-viewed', getRecentlyViewed);

module.exports = router;
