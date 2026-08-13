const Coupon = require('../models/Coupon');
const { sendSuccess, sendError } = require('../utils/responseHandler');

exports.getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Coupons retrieved', { coupons });
  } catch (error) {
    next(error);
  }
};

exports.createCoupon = async (req, res, next) => {
  try {
    const { code, discountType, discountValue, minOrderAmount, maxDiscount, expirationDate } = req.body;
    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxDiscount: maxDiscount || null,
      expirationDate: expirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    return sendSuccess(res, 201, 'Coupon created successfully', { coupon });
  } catch (error) {
    next(error);
  }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return sendError(res, 404, 'Coupon not found');
    return sendSuccess(res, 200, 'Coupon deleted');
  } catch (error) {
    next(error);
  }
};
