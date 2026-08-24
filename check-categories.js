require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const categories = await Category.find().sort('name');

  console.log('\n--- All Categories ---');
  categories.forEach(c => {
    console.log(`${c.name}  ->  type: ${c.type}`);
  });

  const productCount = categories.filter(c => c.type === 'product').length;
  const serviceCount = categories.filter(c => c.type === 'service').length;
  console.log(`\nTotal: ${categories.length} | product-type: ${productCount} | service-type: ${serviceCount}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
