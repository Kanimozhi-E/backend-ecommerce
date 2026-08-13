const express = require('express');
const router = express.Router();
const {
  createReview,
  updateReview,
  deleteReview,
  getProductReviews
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.get('/product/:productId', getProductReviews);

module.exports = router;
