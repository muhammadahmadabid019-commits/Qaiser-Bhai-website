require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI;

// Prices researched from Pakistani retailers (PKR). Where an exact SKU
// listing wasn't available, price is estimated from the K1/K2/Q1 tier and
// channel-count pattern of the confirmed models. All prices are editable
// afterwards from /admin/products.
const nvrProducts = [
  { name: 'DS-7608NXI-K1', channels: 8, previousPrice: 22500, price: 20500 },
  { name: 'DS-7608NXI-K2', channels: 8, previousPrice: 29000, price: 27000 },
  { name: 'DS-7608NXI-Q1', channels: 8, previousPrice: 19500, price: 17500 },
  { name: 'DS-7616NXI-K1', channels: 16, previousPrice: 28000, price: 26000 },
  { name: 'DS-7616NXI-K2', channels: 16, previousPrice: 37000, price: 35000 },
  { name: 'DS-7616NXI-Q1', channels: 16, previousPrice: 23500, price: 21500 },
  { name: 'DS-7632NXI-K1', channels: 32, previousPrice: 33000, price: 31000 },
  { name: 'DS-7632NXI-K2', channels: 32, previousPrice: 39000, price: 37000 },
  { name: 'DS-7632NXI-Q1', channels: 32, previousPrice: 29500, price: 27500 },
  { name: 'DS-7664NXI-K1', channels: 64, previousPrice: 55000, price: 53000 },
  { name: 'DS-7664NXI-K2', channels: 64, previousPrice: 65000, price: 63000 },
  { name: 'DS-7664NXI-Q1', channels: 64, previousPrice: 48000, price: 46000 }
];

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB...');

    let category = await Category.findOne({ name: 'NVRs (Network Video Recorder)' });
    if (!category) {
      category = await Category.create({
        name: 'NVRs (Network Video Recorder)',
        description: 'Hikvision network video recorders for IP CCTV systems'
      });
      console.log('Created category:', category.name);
    } else {
      console.log('Category already exists:', category.name);
    }

    for (const item of nvrProducts) {
      const existing = await Product.findOne({ name: item.name });
      if (existing) {
        console.log(`Skipped (already exists): ${item.name}`);
        continue;
      }

      await Product.create({
        name: item.name,
        description: `Hikvision ${item.channels}-channel AcuSense 4K Network Video Recorder (NVR) for IP CCTV surveillance systems.`,
        price: item.price,
        previousPrice: item.previousPrice,
        category: category._id,
        rating: 4.5,
        stock: 15,
        image: '/images/nvr.png'
      });
      console.log(`Added: ${item.name}`);
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
