const express = require('express');
const router = express.Router();
const { getCoupons, createCoupon, deleteCoupon } = require('../controllers/couponController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', getCoupons);
router.post('/', protect, adminOnly, createCoupon);
router.delete('/:id', protect, adminOnly, deleteCoupon);

module.exports = router;
