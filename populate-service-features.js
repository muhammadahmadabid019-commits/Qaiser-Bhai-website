// One-off content script: fills in the `features` bullet list for each
// service category, shown on the homepage services section
// (views/index.ejs already renders Category.features as a bulleted list —
// it was just empty for all 7 services). Bullets are derived directly from
// each service's own existing `description` field, not invented.
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

const SERVICE_FEATURES = {
  'CCTV Solutions': [
    'Camera installation for round-the-clock property monitoring',
    'DVR/NVR setup and configuration',
    'Ongoing system maintenance and support',
    'Suited for residential and commercial properties'
  ],
  'Electric Fence': [
    'High-voltage electric fence for boundary protection',
    'Strong, safe deterrent against intruders',
    'Energizer unit supplied and installed',
    'Warning signage included for safety compliance'
  ],
  'Networking Solutions': [
    'Structured cabling installation',
    'Router and switch setup and configuration',
    'Wi-Fi network setup and troubleshooting',
    'Fast, stable connectivity across every device'
  ],
  'IT Support & Maintenance': [
    'Troubleshooting for everyday IT issues',
    'Software updates and system patching',
    'Hardware repairs for office and home equipment',
    'Preventive maintenance to minimize downtime'
  ],
  'System / Computer / Laptop Repairing & Maintenance': [
    'Hardware diagnostics and repair',
    'Operating system installation and setup',
    'Virus and malware removal',
    'Data recovery and performance optimization'
  ],
  'Video Intercom': [
    'Clear two-way audio communication with visitors',
    'Live video feed before granting access',
    'Remote entry control from a connected device',
    'Suited for both homes and offices'
  ],
  'Cloud Solutions': [
    'Secure cloud storage and backup',
    'Remote access to your data from anywhere',
    'Scalable setup for growing storage needs',
    'Reliable performance for homes and businesses'
  ]
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  let updated = 0, notFound = 0;
  for (const [name, features] of Object.entries(SERVICE_FEATURES)) {
    const category = await Category.findOne({ name, type: 'service' });
    if (!category) {
      notFound++;
      console.warn(`No service category found matching name: "${name}"`);
      continue;
    }
    category.features = features;
    await category.save();
    updated++;
  }

  console.log({ updated, notFound, totalMapped: Object.keys(SERVICE_FEATURES).length });
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
