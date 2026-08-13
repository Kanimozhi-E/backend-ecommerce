const express = require('express');
const router = express.Router();
const {
  handleNLFilter,
  handleRecommendations,
  handleShoppingAssistant,
  handleReviewSummary
} = require('../controllers/aiController');

router.post('/nl-filter', handleNLFilter);
router.post('/parse-filter', handleNLFilter);
router.post('/recommendations', handleRecommendations);
router.post('/assistant', handleShoppingAssistant);
router.post('/chat', handleShoppingAssistant);
router.get('/summarize-reviews/:productId', handleReviewSummary);

module.exports = router;
