const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String },
  color: { type: String },
  image: { type: String },
  priceOffset: { type: Number, default: 0 },
  stock: { type: Number, default: 10 }
});

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a product title'],
      trim: true,
      index: true
    },
    slug: {
      type: String,
      lowercase: true,
      unique: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Please add a product description']
    },
    price: {
      type: Number,
      required: [true, 'Please add a product price'],
      min: 0
    },
    originalPrice: {
      type: Number,
      default: function() { return this.price; }
    },
    discountPrice: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },
    brand: {
      type: String,
      default: 'Generic',
      index: true
    },
    stock: {
      type: Number,
      required: true,
      default: 1
    },
    images: [
      {
        type: String
      }
    ],
    rating: {
      type: Number,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    numReviews: {
      type: Number,
      default: 0
    },
    specifications: {
      type: Map,
      of: String,
      default: {}
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    variants: [variantSchema],
    isFeatured: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Virtual getter for name compatibility
productSchema.virtual('name').get(function() {
  return this.title;
});

// Auto slug generation
productSchema.pre('save', function (next) {
  if (this.title && (!this.slug || this.isModified('title'))) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  }
  if (this.price && this.discountPrice > 0) {
    this.discount = Math.round(((this.price - this.discountPrice) / this.price) * 100);
  }
  if (this.reviewCount && !this.numReviews) {
    this.numReviews = this.reviewCount;
  }
  next();
});

// Compound text index for fast search queries
productSchema.index({ title: 'text', description: 'text', brand: 'text', tags: 'text' });
productSchema.index({ tags: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });

module.exports = mongoose.model('Product', productSchema);
