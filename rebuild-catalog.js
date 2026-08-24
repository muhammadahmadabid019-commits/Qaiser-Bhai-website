require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI;

const TAXONOMY = {
  'CCTV & Surveillance': {
    description: 'Cameras, recorders and surveillance accessories',
    subcategories: ['NVR', 'DVR', 'IP Cameras', 'Analog Cameras', 'PoE Switches']
  },
  'Networking Equipment': {
    description: 'Routers, switches, access points and fiber gear',
    subcategories: ['Routers', 'Switches', 'Access Points', 'Fiber Equipment']
  },
  'Structured Cabling': {
    description: 'Cable and cabling infrastructure for data and voice networks',
    subcategories: ['CAT5e/CAT6 Cable', 'Fiber Optic Cable', 'Cable Trunking & Conduit', 'Patch Panels']
  },
  'Connectors & Accessories': {
    description: 'Connectors, adapters and small hardware for installs',
    subcategories: ['RJ45 Connectors', 'BNC Connectors', 'Power Connectors', 'Adapters & Couplers']
  },
  'Power Solutions': {
    description: 'Power backup and distribution for security & network systems',
    subcategories: ['UPS', 'SMPS/Power Supplies', 'PoE Injectors', 'Batteries']
  },
  'Racks & Cabinets': {
    description: 'Server and network equipment racks and enclosures',
    subcategories: ['Wall-Mount Racks', 'Floor-Standing Racks', 'Open Frame Racks', 'Rack Accessories']
  },
  'Installation Tools': {
    description: 'Tools for cable termination, testing and mounting',
    subcategories: ['Crimping Tools', 'Cable Testers', 'Termination Tools', 'Ladders & Mounting Hardware']
  },
  'HDMI & Display Accessories': {
    description: 'HDMI cabling and display connectivity accessories',
    subcategories: ['HDMI Cables', 'HDMI Extenders/Splitters', 'Display Mounts', 'AV Adapters']
  }
};

const TIER_LABEL = { K1: '1 SATA HDD Bay', K2: '2 SATA HDD Bays', Q1: 'Value Series, 1 SATA HDD Bay' };

function nvrSpecs(name) {
  const channelsMatch = name.match(/DS-76(\d{2})/);
  const channels = channelsMatch ? parseInt(channelsMatch[1], 10) : null;
  const tier = name.split('-').pop();
  return {
    keyFeatures: [
      `${channels}-channel AcuSense 4K NVR`,
      'H.265+ video compression',
      'Motion Detection 2.0 with human/vehicle classification',
      'Remote viewing via Hik-Connect mobile app'
    ],
    specifications: [
      { label: 'Channels', value: `${channels}` },
      { label: 'Video Output', value: 'HDMI / VGA (up to 4K)' },
      { label: 'Storage', value: TIER_LABEL[tier] || '1-2 SATA HDD Bays' },
      { label: 'Compression', value: 'H.265+ / H.265 / H.264+ / H.264' },
      { label: 'Network', value: '1 RJ45 10M/100M/1000M self-adaptive Ethernet interface' }
    ]
  };
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB...');

    const nvrCategory = await Category.findOne({ name: 'NVRs (Network Video Recorder)' });
    const keeperIds = nvrCategory
      ? (await Product.find({ category: nvrCategory._id }, '_id')).map(p => p._id)
      : [];
    console.log(`Keeping ${keeperIds.length} existing NVR products.`);

    const deleted = await Product.deleteMany({ _id: { $nin: keeperIds } });
    console.log(`Deleted ${deleted.deletedCount} non-keeper products.`);

    await Category.deleteMany({ name: { $in: ['Electronics', 'CCTV', 'Networking'] } });
    console.log('Removed old generic categories.');

    const categoryDocs = {};
    const subcategoryDocs = {};

    for (const [catName, catData] of Object.entries(TAXONOMY)) {
      let category = await Category.findOne({ name: catName });
      if (!category) {
        category = await Category.create({ name: catName, description: catData.description });
        console.log(`Created category: ${catName}`);
      }
      categoryDocs[catName] = category;

      for (const subName of catData.subcategories) {
        let sub = await Subcategory.findOne({ name: subName, category: category._id });
        if (!sub) {
          sub = await Subcategory.create({ name: subName, category: category._id });
          console.log(`  Created subcategory: ${catName} -> ${subName}`);
        }
        subcategoryDocs[`${catName}::${subName}`] = sub;
      }
    }

    const targetCategory = categoryDocs['CCTV & Surveillance'];
    const targetSubcategory = subcategoryDocs['CCTV & Surveillance::NVR'];

    const keepers = await Product.find({ _id: { $in: keeperIds } });
    for (const product of keepers) {
      const { keyFeatures, specifications } = nvrSpecs(product.name);
      product.category = targetCategory._id;
      product.subcategory = targetSubcategory._id;
      product.brand = 'Hikvision';
      product.keyFeatures = keyFeatures;
      product.specifications = specifications;
      await product.save();
      console.log(`Re-pointed: ${product.name}`);
    }

    if (nvrCategory) {
      await Category.deleteOne({ _id: nvrCategory._id });
      console.log('Removed legacy "NVRs (Network Video Recorder)" category.');
    }

    console.log('Rebuild complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
