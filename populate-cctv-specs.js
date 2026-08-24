// One-off, idempotent script: populates keyFeatures + specifications for
// the 24 CCTV catalog-entry products (DVR, IP cameras, analog cameras,
// PoE switches) added in an earlier batch with placeholder-only data.
//
// Does NOT touch name, price, brand, stock, category, subcategory, or
// slug on any product, and does NOT touch the 12 Hikvision NVR products
// (which already have real specifications from an earlier batch) or any
// other product outside this named list. No datasheetUrl is set — there's
// no real datasheet PDF to link to; the detail page already hides that
// section cleanly when datasheetUrl is empty.
//
// Safe to re-run: each product is looked up by exact name and only
// updated (never created), so re-running just re-applies the same content.
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI;

function dvrSpecs(channels, bays) {
  return {
    keyFeatures: [
      `${channels}-channel Turbo HD DVR`,
      'H.265+ video compression',
      'Supports HD-TVI / AHD / HDCVI / CVBS / IP camera inputs',
      'Remote viewing via mobile app'
    ],
    specifications: [
      { label: 'Channels', value: `${channels}` },
      { label: 'Video Output', value: 'HDMI / VGA' },
      { label: 'Compression', value: 'H.265+ / H.265 / H.264+ / H.264' },
      { label: 'Storage', value: `${bays} SATA HDD Bay${bays > 1 ? 's' : ''} (up to 10TB each)` },
      { label: 'Network', value: '1 RJ45 10M/100M self-adaptive Ethernet interface' }
    ]
  };
}

function bulletSpecs(resolution) {
  return {
    keyFeatures: [
      `${resolution} fixed-lens IP bullet camera`,
      'IR night vision up to 30m',
      'IP67 weatherproof rating',
      'PoE powered'
    ],
    specifications: [
      { label: 'Resolution', value: resolution },
      { label: 'Lens', value: '2.8mm fixed' },
      { label: 'Night Vision', value: 'Up to 30m IR' },
      { label: 'Protection Rating', value: 'IP67' },
      { label: 'Power', value: 'PoE (802.3af)' }
    ]
  };
}

function domeSpecs(resolution) {
  return {
    keyFeatures: [
      `${resolution} fixed-lens IP dome camera`,
      'IR night vision up to 20m',
      'Vandal-resistant IK10 housing',
      'PoE powered'
    ],
    specifications: [
      { label: 'Resolution', value: resolution },
      { label: 'Lens', value: '2.8mm fixed' },
      { label: 'Night Vision', value: 'Up to 20m IR' },
      { label: 'Protection Rating', value: 'IP67 / IK10' },
      { label: 'Power', value: 'PoE (802.3af)' }
    ]
  };
}

function tviSpecs(resolution) {
  return {
    keyFeatures: [
      `${resolution} HD-TVI analog camera`,
      '4-in-1 switchable (TVI / AHD / HDCVI / CVBS)',
      'IR night vision up to 20m',
      'Weatherproof housing'
    ],
    specifications: [
      { label: 'Resolution', value: resolution },
      { label: 'Signal', value: 'HD-TVI / AHD / HDCVI / CVBS switchable' },
      { label: 'Night Vision', value: 'Up to 20m IR' },
      { label: 'Protection Rating', value: 'IP66' },
      { label: 'Power', value: '12V DC' }
    ]
  };
}

const CONTENT = {
  '4 Channel DVR': dvrSpecs(4, 1),
  '8 Channel DVR': dvrSpecs(8, 1),
  '16 Channel DVR': dvrSpecs(16, 2),
  '32 Channel DVR': dvrSpecs(32, 2),

  '2MP IP Bullet': bulletSpecs('2MP (1080p)'),
  '4MP IP Bullet': bulletSpecs('4MP'),
  '5MP IP Bullet': bulletSpecs('5MP'),
  '8MP IP Bullet': bulletSpecs('8MP (4K)'),

  '2MP Dome': domeSpecs('2MP (1080p)'),
  '4MP Dome': domeSpecs('4MP'),
  '5MP Dome': domeSpecs('5MP'),
  '8MP Dome': domeSpecs('8MP (4K)'),

  'Mini PTZ': {
    keyFeatures: [
      'Compact pan-tilt-zoom IP camera',
      '4x optical zoom',
      'Auto-tracking support',
      'PoE powered'
    ],
    specifications: [
      { label: 'Zoom', value: '4x optical' },
      { label: 'Pan Range', value: '355° continuous' },
      { label: 'Tilt Range', value: '0° - 90°' },
      { label: 'Mount', value: 'Ceiling / Wall' },
      { label: 'Power', value: 'PoE (802.3af)' }
    ]
  },
  'Speed Dome PTZ': {
    keyFeatures: [
      'High-speed pan-tilt-zoom dome camera',
      '20x optical zoom',
      '360° continuous rotation',
      'IP66 weatherproof housing'
    ],
    specifications: [
      { label: 'Zoom', value: '20x optical' },
      { label: 'Pan Range', value: '360° continuous' },
      { label: 'Tilt Range', value: '-15° to 90°' },
      { label: 'Protection Rating', value: 'IP66' },
      { label: 'Power', value: '24V AC / PoE+' }
    ]
  },
  'Outdoor PTZ': {
    keyFeatures: [
      'Outdoor-rated pan-tilt-zoom camera',
      '20x optical zoom with long-range IR',
      'IP66 weatherproof housing',
      'Wiper-mount ready'
    ],
    specifications: [
      { label: 'Zoom', value: '20x optical' },
      { label: 'Night Vision', value: 'Up to 100m IR' },
      { label: 'Protection Rating', value: 'IP66' },
      { label: 'Power', value: '24V AC / PoE+' }
    ]
  },

  '2MP Analog Camera': tviSpecs('2MP (1080p)'),
  '5MP Analog Camera': tviSpecs('5MP'),

  'Indoor Dome Camera': {
    keyFeatures: [
      'Indoor fixed-lens dome camera',
      '1080p HD-TVI resolution',
      'IR night vision up to 15m',
      'Compact ceiling-mount design'
    ],
    specifications: [
      { label: 'Resolution', value: '1080p (2MP)' },
      { label: 'Signal', value: 'HD-TVI / AHD / HDCVI / CVBS' },
      { label: 'Night Vision', value: 'Up to 15m IR' },
      { label: 'Mount', value: 'Ceiling' },
      { label: 'Power', value: '12V DC' }
    ]
  },
  'Outdoor Dome Camera': {
    keyFeatures: [
      'Outdoor weatherproof dome camera',
      '1080p HD-TVI resolution',
      'IR night vision up to 30m',
      'IP66 weatherproof housing'
    ],
    specifications: [
      { label: 'Resolution', value: '1080p (2MP)' },
      { label: 'Signal', value: 'HD-TVI / AHD / HDCVI / CVBS' },
      { label: 'Night Vision', value: 'Up to 30m IR' },
      { label: 'Protection Rating', value: 'IP66' },
      { label: 'Power', value: '12V DC' }
    ]
  },

  '4 Port PoE Switch': {
    keyFeatures: ['4-port PoE network switch', 'IEEE 802.3af/at PoE power delivery', 'Plug-and-play for IP cameras', 'Durable metal housing'],
    specifications: [
      { label: 'Ports', value: '4x 10/100M PoE + 1x 100M Uplink' },
      { label: 'PoE Standard', value: 'IEEE 802.3af/at' },
      { label: 'PoE Budget', value: '65W total' },
      { label: 'Switching Capacity', value: '1.6 Gbps' },
      { label: 'Power Input', value: 'AC 100-240V' }
    ]
  },
  '8 Port PoE Switch': {
    keyFeatures: ['8-port PoE network switch', 'IEEE 802.3af/at PoE power delivery', 'Plug-and-play for IP cameras', 'Durable metal housing'],
    specifications: [
      { label: 'Ports', value: '8x 10/100M PoE + 1x Gigabit Uplink' },
      { label: 'PoE Standard', value: 'IEEE 802.3af/at' },
      { label: 'PoE Budget', value: '120W total' },
      { label: 'Switching Capacity', value: '3.6 Gbps' },
      { label: 'Power Input', value: 'AC 100-240V' }
    ]
  },
  '16 Port PoE Switch': {
    keyFeatures: ['16-port PoE network switch', 'IEEE 802.3af/at PoE power delivery', 'Plug-and-play for IP cameras', 'Durable metal housing'],
    specifications: [
      { label: 'Ports', value: '16x 10/100M PoE + 2x Gigabit Uplink' },
      { label: 'PoE Standard', value: 'IEEE 802.3af/at' },
      { label: 'PoE Budget', value: '230W total' },
      { label: 'Switching Capacity', value: '6.4 Gbps' },
      { label: 'Power Input', value: 'AC 100-240V' }
    ]
  },
  '24 Port PoE Switch': {
    keyFeatures: ['24-port PoE network switch', 'IEEE 802.3af/at PoE power delivery', 'Plug-and-play for IP cameras', 'Rack-mountable metal housing'],
    specifications: [
      { label: 'Ports', value: '24x 10/100M PoE + 2x Gigabit + 2x SFP Uplink' },
      { label: 'PoE Standard', value: 'IEEE 802.3af/at' },
      { label: 'PoE Budget', value: '370W total' },
      { label: 'Switching Capacity', value: '12.8 Gbps' },
      { label: 'Power Input', value: 'AC 100-240V' }
    ]
  },
  '48 Port PoE Switch': {
    keyFeatures: ['48-port PoE network switch', 'IEEE 802.3af/at PoE power delivery', 'Plug-and-play for IP cameras', 'Rack-mountable metal housing'],
    specifications: [
      { label: 'Ports', value: '48x 10/100M PoE + 4x Gigabit + 4x SFP Uplink' },
      { label: 'PoE Standard', value: 'IEEE 802.3af/at' },
      { label: 'PoE Budget', value: '600W total' },
      { label: 'Switching Capacity', value: '24 Gbps' },
      { label: 'Power Input', value: 'AC 100-240V' }
    ]
  }
};

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB...');

    let updated = 0;
    let notFound = 0;

    for (const [name, content] of Object.entries(CONTENT)) {
      const product = await Product.findOne({ name });
      if (!product) {
        console.log(`  NOT FOUND (skipped): ${name}`);
        notFound++;
        continue;
      }

      product.set({
        keyFeatures: content.keyFeatures,
        specifications: content.specifications
      });
      await product.save();
      console.log(`  Updated: ${name}`);
      updated++;
    }

    console.log(`\nDone. Updated ${updated} products, ${notFound} not found.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
