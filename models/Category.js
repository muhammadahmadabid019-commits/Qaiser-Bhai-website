const mongoose = require('mongoose');
const slugify = require('slugify');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  // Reusable across catalogs: 'product' categories feed the product hierarchy
  // (Category -> Subcategory -> Product), 'service' categories are a separate,
  // parallel catalog for non-product offerings and are never returned to
  // product-facing queries/filters.
  type: {
    type: String,
    enum: ['product', 'service'],
    default: 'product',
    required: true
  },
  // The following fields are only used for display when type: 'service'
  icon: {
    type: String,
    trim: true,
    default: 'fa-cogs' // FontAwesome icon class, e.g. 'fa-camera'
  },
  image: {
    type: String,
    trim: true,
    default: ''
  },
  features: [{
    type: String,
    trim: true
  }],
  featured: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

CategorySchema.pre('save', function() {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model('Category', CategorySchema);
