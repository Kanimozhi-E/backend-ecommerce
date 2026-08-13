const { sendError } = require('../utils/responseHandler');

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !name.trim()) {
    return sendError(res, 400, 'Name is required');
  }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return sendError(res, 400, 'A valid email address is required');
  }
  if (!password || password.length < 6) {
    return sendError(res, 400, 'Password must be at least 6 characters long');
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return sendError(res, 400, 'Please provide both email and password');
  }
  next();
};

const validateProduct = (req, res, next) => {
  const { title, name, price, category, stock } = req.body;
  const productTitle = title || name;
  if (!productTitle) {
    return sendError(res, 400, 'Product title/name is required');
  }
  if (price === undefined || price < 0) {
    return sendError(res, 400, 'Valid price is required');
  }
  if (!category) {
    return sendError(res, 400, 'Product category is required');
  }
  if (stock === undefined || stock < 0) {
    return sendError(res, 400, 'Valid stock count is required');
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateProduct
};
