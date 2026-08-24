const mongoose = require('mongoose');
const slugify = require('slugify');

const SubcategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  description: {
    type: String,
    trim: true
  }
}, { timestamps: true });

SubcategorySchema.index({ category: 1, slug: 1 }, { unique: true });

SubcategorySchema.pre('save', function() {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model('Subcategory', SubcategorySchema);
