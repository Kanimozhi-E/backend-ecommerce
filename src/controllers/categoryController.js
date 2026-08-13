const Category = require('../models/Category');
const { sendSuccess, sendError } = require('../utils/responseHandler');

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, 200, 'Categories retrieved', { categories });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, image } = req.body;
    const category = await Category.create({ name, description, image });
    return sendSuccess(res, 201, 'Category created', { category });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!category) return sendError(res, 404, 'Category not found');
    return sendSuccess(res, 200, 'Category updated', { category });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return sendError(res, 404, 'Category not found');
    return sendSuccess(res, 200, 'Category deleted');
  } catch (error) {
    next(error);
  }
};
