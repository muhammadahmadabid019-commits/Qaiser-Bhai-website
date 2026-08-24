const mongoose = require('mongoose');
const slugify = require('slugify');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  slug: {
    type: String,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  previousPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subcategory',
    default: null,
    index: true
  },
  brand: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  keyFeatures: {
    type: [String],
    default: []
  },
  specifications: {
    type: [{
      label: { type: String, trim: true },
      value: { type: String, trim: true },
      _id: false
    }],
    default: []
  },
  datasheetUrl: {
    type: String,
    trim: true,
    default: ''
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 10
  },
  image: {
    type: String,
    default: 'https://via.placeholder.com/300x200?text=No+Image'
  }
}, { timestamps: true });

ProductSchema.pre('save', function() {
  if (this.isNew) {
    // Allow a caller to pre-set a disambiguated slug (e.g. on collision retry)
    if (!this.slug) {
      this.slug = slugify(this.name, { lower: true, strict: true });
    }
  } else if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model('Product', ProductSchema);
