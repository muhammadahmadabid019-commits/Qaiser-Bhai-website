const mongoose = require('mongoose');
const config = require('config');
const Category = require('./models/Category');
const Product = require('./models/Product');

const MONGO_URI = config.get('mongoURI');

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB for seeding...');

    await Category.deleteMany({});
    await Product.deleteMany({});

    const electronics = await Category.create({ name: 'Electronics', description: 'Gadgets and devices' });
    const cctv = await Category.create({ name: 'CCTV', description: 'Surveillance cameras and equipment' });
    const networking = await Category.create({ name: 'Networking', description: 'Routers, switches, and cables' });

    const categories = [electronics, cctv, networking];
    const products = [];

    // Base names for some variation
    const baseNames = [
      'Pro Camera', 'Network Switch', 'Wi-Fi Router', 'Dome Camera', 
      'Bullet Camera', 'NVR System', 'CAT6 Cable', 'PoE Switch', 
      'Smart Hub', 'Security Monitor'
    ];

    const actualImages = [
      '/images/dome-camera.png',
      '/images/nvr.png',
      '/images/wifi-router.png',
      '/images/poe-switch.png',
      '/images/cat6-cable.png',
      '/images/bullet-camera.png'
    ];

    for (let i = 1; i <= 30; i++) {
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];
      const randomImage = actualImages[Math.floor(Math.random() * actualImages.length)];
      
      products.push({
        name: `${baseName} Model ${i}`,
        description: `This is a high quality ${baseName.toLowerCase()} perfect for your security and networking needs.`,
        price: Math.floor(Math.random() * 500) + 50, // Price between 50 and 550
        category: randomCategory._id,
        rating: (Math.random() * 2 + 3).toFixed(1), // Rating between 3.0 and 5.0
        stock: Math.floor(Math.random() * 100) + 10,
        image: randomImage
      });
    }

    await Product.create(products);

    console.log('30 Products seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
