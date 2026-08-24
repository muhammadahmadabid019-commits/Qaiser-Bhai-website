// One-off, idempotent script: replaces placeholder descriptions and
// "TBD" brand on the 92 catalog-entry products that still have them,
// with professional, category-appropriate content and realistic brands
// commonly sold in the Pakistani CCTV/networking market.
//
// - Products whose keyFeatures are already populated (the 24 CCTV
//   products from populate-cctv-specs.js) keep those keyFeatures as-is;
//   only description + brand are updated for them.
// - Products with no existing keyFeatures get description + brand +
//   3 keyFeatures.
//
// Does NOT touch price, previousPrice, stock, category, subcategory,
// slug, specifications, or datasheetUrl on any product, and does not
// touch the 12 Hikvision NVR products (already fully content-complete).
// Safe to re-run: content is looked up and applied by exact product name.
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI;

// ---- Products that already have real keyFeatures (CCTV batch) ----
// Only description + brand are set for these.
const DESCRIPTION_AND_BRAND_ONLY = {
  '4 Channel DVR': { brand: 'Hikvision', description: '4-channel digital video recorder for HD-TVI, AHD, HDCVI and analog CCTV camera systems.' },
  '8 Channel DVR': { brand: 'Dahua', description: '8-channel digital video recorder for HD-TVI, AHD, HDCVI and analog CCTV camera systems.' },
  '16 Channel DVR': { brand: 'Uniview', description: '16-channel digital video recorder for HD-TVI, AHD, HDCVI and analog CCTV camera systems.' },
  '32 Channel DVR': { brand: 'Hikvision', description: '32-channel digital video recorder for HD-TVI, AHD, HDCVI and analog CCTV camera systems.' },

  '2MP IP Bullet': { brand: 'Hikvision', description: '2MP IP bullet camera built for outdoor perimeter and long-range surveillance.' },
  '4MP IP Bullet': { brand: 'Dahua', description: '4MP IP bullet camera built for outdoor perimeter and long-range surveillance.' },
  '5MP IP Bullet': { brand: 'Uniview', description: '5MP IP bullet camera built for outdoor perimeter and long-range surveillance.' },
  '8MP IP Bullet': { brand: 'Hikvision', description: '8MP (4K) IP bullet camera built for outdoor perimeter and long-range surveillance.' },

  '2MP Dome': { brand: 'Dahua', description: '2MP IP dome camera designed for discreet indoor and outdoor surveillance.' },
  '4MP Dome': { brand: 'Hikvision', description: '4MP IP dome camera designed for discreet indoor and outdoor surveillance.' },
  '5MP Dome': { brand: 'Uniview', description: '5MP IP dome camera designed for discreet indoor and outdoor surveillance.' },
  '8MP Dome': { brand: 'Dahua', description: '8MP (4K) IP dome camera designed for discreet indoor and outdoor surveillance.' },

  'Mini PTZ': { brand: 'Hikvision', description: 'Compact pan-tilt-zoom IP camera for flexible coverage of medium-sized areas.' },
  'Speed Dome PTZ': { brand: 'Dahua', description: 'High-speed dome camera with long-range optical zoom for wide-area surveillance.' },
  'Outdoor PTZ': { brand: 'Uniview', description: 'Outdoor-rated PTZ camera built for large-area perimeter and facility surveillance.' },

  '2MP Analog Camera': { brand: 'Hikvision', description: '2MP HD-TVI analog camera offering an affordable upgrade from standard CCTV.' },
  '5MP Analog Camera': { brand: 'Dahua', description: '5MP HD-TVI analog camera for sharper detail on existing coaxial cabling.' },

  'Indoor Dome Camera': { brand: 'Dahua', description: 'Indoor HD analog dome camera for offices, retail and residential interiors.' },
  'Outdoor Dome Camera': { brand: 'Hikvision', description: 'Weatherproof HD analog dome camera for outdoor entrances and perimeters.' },

  '4 Port PoE Switch': { brand: 'Hikvision', description: '4-port PoE network switch that powers and connects IP cameras over a single cable.' },
  '8 Port PoE Switch': { brand: 'Dahua', description: '8-port PoE network switch that powers and connects IP cameras over a single cable.' },
  '16 Port PoE Switch': { brand: 'TP-Link', description: '16-port PoE network switch that powers and connects IP cameras over a single cable.' },
  '24 Port PoE Switch': { brand: 'Uniview', description: '24-port PoE network switch that powers and connects IP cameras over a single cable.' },
  '48 Port PoE Switch': { brand: 'TP-Link', description: '48-port PoE network switch that powers and connects IP cameras over a single cable.' }
};

// ---- Products with no existing keyFeatures ----
// description + brand + 3 keyFeatures are all set for these.
const FULL_CONTENT = {
  // Networking Equipment — Unmanaged Switches
  '5 Port Unmanaged Switch': { brand: 'TP-Link', description: '5-port unmanaged network switch for simple, reliable Ethernet connectivity.', keyFeatures: ['Plug-and-play setup with no configuration required', '5 ports for expanding wired network connections', 'Compact, durable design for home or small office networks'] },
  '8 Port Unmanaged Switch': { brand: 'D-Link', description: '8-port unmanaged network switch for simple, reliable Ethernet connectivity.', keyFeatures: ['Plug-and-play setup with no configuration required', '8 ports for expanding wired network connections', 'Compact, durable design for office networks'] },
  '16 Port Unmanaged Switch': { brand: 'TP-Link', description: '16-port unmanaged network switch for simple, reliable Ethernet connectivity.', keyFeatures: ['Plug-and-play setup with no configuration required', '16 ports for expanding wired network connections', 'Reliable performance for growing office networks'] },
  '24 Port Unmanaged Switch': { brand: 'D-Link', description: '24-port unmanaged network switch for simple, reliable Ethernet connectivity.', keyFeatures: ['Plug-and-play setup with no configuration required', '24 ports for larger wired network deployments', 'Durable design built for continuous operation'] },
  '48 Port Unmanaged Switch': { brand: 'TP-Link', description: '48-port unmanaged network switch for simple, reliable Ethernet connectivity.', keyFeatures: ['Plug-and-play setup with no configuration required', '48 ports for large-scale wired network deployments', 'Rack-mountable design for server rooms and data closets'] },

  // Networking Equipment — Managed Switches
  'Layer 2 Switch': { brand: 'Cisco', description: 'Layer 2 managed switch offering VLAN segmentation and traffic control for growing networks.', keyFeatures: ['VLAN support for segmenting and securing network traffic', 'Web-based management for full switch configuration', 'Ideal for offices and multi-department networks'] },
  'Layer 3 Switch': { brand: 'Cisco', description: 'Layer 3 managed switch with inter-VLAN routing for larger, segmented networks.', keyFeatures: ['Combines switching and routing in a single device', 'Inter-VLAN routing for multi-network environments', 'Advanced traffic management for demanding networks'] },
  'Smart Switch': { brand: 'TP-Link', description: 'Smart managed switch offering essential VLAN and QoS features at an affordable price.', keyFeatures: ['Web-based management for basic network control', 'QoS support to prioritize critical network traffic', 'Cost-effective step up from unmanaged switching'] },

  // Networking Equipment — Routers
  'Home Router': { brand: 'TP-Link', description: 'Wireless home router for reliable everyday internet connectivity.', keyFeatures: ['Dual-band Wi-Fi coverage for home connectivity', 'Simple setup for everyday internet use', 'Stable performance for streaming and browsing'] },
  'Business Router': { brand: 'Cisco', description: 'Business-grade router built for stable, secure office connectivity.', keyFeatures: ['Reliable performance for multi-user office networks', 'Advanced security features to protect business data', 'Supports multiple wired and wireless connections'] },
  'VPN Router': { brand: 'Ubiquiti', description: 'VPN-capable router for secure remote access to business networks.', keyFeatures: ['Built-in VPN support for secure remote connections', 'Protects data across public and remote networks', 'Suited for businesses with remote or branch offices'] },
  'Multi-WAN Router': { brand: 'Ubiquiti', description: 'Multi-WAN router that balances and fails over across multiple internet connections.', keyFeatures: ['Combines multiple internet connections for load balancing', 'Automatic failover keeps networks online during outages', 'Ideal for businesses needing continuous connectivity'] },

  // Networking Equipment — Access Points
  'Indoor Access Point': { brand: 'Ubiquiti', description: 'Indoor wireless access point for extending reliable Wi-Fi coverage.', keyFeatures: ['Extends Wi-Fi coverage across offices and homes', 'Supports multiple simultaneous device connections', 'Simple ceiling or wall-mount installation'] },
  'Outdoor Access Point': { brand: 'Ubiquiti', description: 'Weatherproof outdoor access point for extending Wi-Fi across open areas.', keyFeatures: ['Weatherproof housing for outdoor installation', 'Extends wireless coverage across yards and campuses', 'Stable connectivity for outdoor devices and cameras'] },
  'Ceiling Mount AP': { brand: 'Ruijie', description: 'Ceiling-mounted access point for discreet, even Wi-Fi coverage indoors.', keyFeatures: ['Low-profile design for unobtrusive ceiling mounting', 'Even Wi-Fi coverage across offices and hallways', 'PoE powered for simplified installation'] },

  // Networking Equipment — Wireless Bridges
  'Point-to-Point Bridge': { brand: 'Ubiquiti', description: 'Point-to-point wireless bridge for connecting two remote network locations.', keyFeatures: ['Links two sites without running physical cable', 'Long-range wireless connectivity between buildings', 'Stable, high-throughput link for data and CCTV traffic'] },
  'Point-to-Multipoint Bridge': { brand: 'Ubiquiti', description: 'Point-to-multipoint wireless bridge for connecting several remote sites to one network.', keyFeatures: ['Connects multiple remote locations to a central network', 'Reduces cabling costs across spread-out sites', 'Reliable wireless backbone for multi-site deployments'] },

  // Networking Equipment — Fiber Optic Networking
  'SFP Module': { brand: 'Cisco', description: 'SFP transceiver module for extending network connectivity over fiber optic cable.', keyFeatures: ['Adds fiber connectivity to compatible switches and routers', 'Extends network reach beyond copper cabling limits', 'Hot-swappable for easy installation and replacement'] },
  'SFP+ Module': { brand: 'Cisco', description: 'SFP+ transceiver module for high-speed 10G fiber network connections.', keyFeatures: ['Supports 10 Gigabit fiber connectivity', 'Hot-swappable for easy installation and replacement', 'Ideal for high-bandwidth network backbones'] },
  'Media Converter': { brand: 'D-Link', description: 'Media converter for bridging copper Ethernet and fiber optic network segments.', keyFeatures: ['Converts copper Ethernet to fiber optic signal and back', 'Extends network distance beyond copper cable limits', 'Simple plug-and-play installation'] },
  'Fiber Patch Cord': { brand: 'AMP', description: 'Pre-terminated fiber optic patch cord for connecting fiber equipment and panels.', keyFeatures: ['Factory-terminated connectors for reliable fiber connections', 'Low signal loss for stable high-speed links', 'Available for structured cabling and fiber backbone use'] },
  'Fiber Distribution Box': { brand: 'Nexans', description: 'Fiber distribution box for organizing and protecting fiber optic cable terminations.', keyFeatures: ['Organizes and protects fiber cable splices and terminations', 'Simplifies fiber network management and maintenance', 'Durable enclosure for indoor or outdoor installation'] },
  'Fiber Termination Box': { brand: 'Nexans', description: 'Fiber termination box for neatly terminating incoming fiber optic cables.', keyFeatures: ['Provides a secure termination point for fiber cabling', 'Protects fiber splices from damage and dust', 'Suited for FTTH and structured fiber installations'] },

  // Structured Cabling — UTP Cables
  'CAT5e Cable': { brand: 'AMP', description: 'CAT5e Ethernet cable for reliable data and voice network cabling.', keyFeatures: ['Supports up to 1 Gbps network speeds', 'Cost-effective choice for standard office cabling', 'Reliable signal transmission for data and VoIP'] },
  'CAT6 Cable': { brand: 'Schneider', description: 'High-performance Ethernet cable for Gigabit networking.', keyFeatures: ['Suitable for structured cabling and office networks', 'Reliable data transmission with reduced interference', 'Supports Gigabit speeds for demanding network use'] },
  'CAT6A Cable': { brand: 'Nexans', description: 'CAT6A Ethernet cable engineered for 10 Gigabit network performance.', keyFeatures: ['Supports 10 Gigabit speeds over longer cable runs', 'Improved shielding reduces crosstalk and interference', 'Future-ready choice for high-bandwidth networks'] },
  'CAT7 Cable': { brand: 'Molex', description: 'CAT7 shielded Ethernet cable for maximum-performance data networks.', keyFeatures: ['Fully shielded design for superior noise immunity', 'Supports high-speed data transmission for demanding networks', 'Ideal for data centers and high-density cabling'] },

  // Structured Cabling — Fiber Cables
  'Single Mode Fiber': { brand: 'Nexans', description: 'Single mode fiber optic cable for long-distance, high-bandwidth connections.', keyFeatures: ['Supports long-distance data transmission with minimal loss', 'High bandwidth for backbone and campus networks', 'Ideal for connecting buildings and remote sites'] },
  'Multi Mode Fiber': { brand: 'AMP', description: 'Multi mode fiber optic cable for high-speed connections within buildings and campuses.', keyFeatures: ['Cost-effective fiber solution for shorter distances', 'High-speed data transmission within buildings', 'Widely used for LAN and data center connections'] },

  // Structured Cabling — Coaxial Cables
  'RG59 Cable': { brand: 'AMP', description: 'RG59 coaxial cable for standard analog CCTV camera installations.', keyFeatures: ['Reliable video signal transmission for analog cameras', 'Widely compatible with standard CCTV systems', 'Suitable for short to medium camera cable runs'] },
  'RG6 Cable': { brand: 'Molex', description: 'RG6 coaxial cable for CCTV and video signal applications requiring longer runs.', keyFeatures: ['Lower signal loss over longer cable distances', 'Suitable for CCTV and satellite/video applications', 'Durable construction for indoor and outdoor use'] },

  // Structured Cabling — Patch Cords
  'CAT6 Patch Cord': { brand: 'Schneider', description: 'Pre-terminated CAT6 patch cord for connecting network devices to patch panels.', keyFeatures: ['Factory-terminated for reliable, tested connections', 'Supports Gigabit network speeds', 'Available in multiple lengths for rack and desktop use'] },
  'CAT6A Patch Cord': { brand: 'AMP', description: 'Pre-terminated CAT6A patch cord for high-speed structured cabling connections.', keyFeatures: ['Factory-terminated for reliable, tested connections', 'Supports 10 Gigabit network speeds', 'Ideal for data center and server room connections'] },

  // Connectors & Accessories — RJ45 Connectors
  'UTP RJ45 Connector': { brand: 'AMP', description: 'UTP RJ45 connector for terminating unshielded Ethernet cable.', keyFeatures: ['Compatible with CAT5e, CAT6 and CAT6A UTP cable', 'Gold-plated contacts for reliable signal transmission', 'Standard connector for structured cabling installations'] },
  'STP RJ45 Connector': { brand: 'Molex', description: 'Shielded RJ45 connector for terminating STP Ethernet cable in high-interference environments.', keyFeatures: ['Shielded design reduces electromagnetic interference', 'Compatible with shielded CAT6/CAT6A cabling', 'Suited for industrial and high-EMI installations'] },
  'FTP RJ45 Connector': { brand: 'Schneider', description: 'Foil-shielded RJ45 connector for terminating FTP Ethernet cable.', keyFeatures: ['Foil shielding improves noise resistance', 'Compatible with FTP structured cabling', 'Reliable termination for demanding network environments'] },

  // Connectors & Accessories — CCTV Connectors
  'BNC Connector': { brand: 'Hikvision', description: 'BNC connector for terminating coaxial cable in analog CCTV systems.', keyFeatures: ['Secure, twist-lock connection for coaxial video cable', 'Standard connector for analog CCTV installations', 'Reliable video signal transmission'] },
  'DC Male Connector': { brand: 'Dahua', description: 'DC male power connector for supplying power to CCTV cameras and equipment.', keyFeatures: ['Standard connector for 12V CCTV camera power', 'Secure fit for reliable power delivery', 'Compatible with most CCTV power cabling'] },
  'DC Female Connector': { brand: 'Dahua', description: 'DC female power connector for CCTV camera and power supply wiring.', keyFeatures: ['Pairs with standard DC male connectors', 'Reliable power connection for CCTV installations', 'Simple wiring for camera power runs'] },
  'Video Balun': { brand: 'Hikvision', description: 'Passive video balun for transmitting analog CCTV signal over UTP cable.', keyFeatures: ['Transmits video signal over CAT5/CAT6 cable instead of coax', 'Reduces cabling costs on long camera runs', 'Simple, passive installation with no external power'] },

  // Connectors & Accessories — Keystone Jacks
  'CAT5e Keystone': { brand: 'AMP', description: 'CAT5e keystone jack for terminating network cable at faceplates and patch panels.', keyFeatures: ['Tool-less or punch-down termination options', 'Compatible with standard keystone faceplates', 'Reliable connection for CAT5e network drops'] },
  'CAT6 Keystone': { brand: 'Molex', description: 'CAT6 keystone jack for Gigabit-rated network wall outlets.', keyFeatures: ['Supports Gigabit network speeds', 'Compatible with standard keystone faceplates', 'Durable termination for office and home network drops'] },
  'CAT6A Keystone': { brand: 'Schneider', description: 'CAT6A keystone jack for high-speed structured cabling wall outlets.', keyFeatures: ['Supports 10 Gigabit network speeds', 'Improved shielding for reduced interference', 'Ideal for high-performance structured cabling'] },

  // Connectors & Accessories — Faceplates & Back Boxes
  'Single Port Faceplate': { brand: 'AMP', description: 'Single port faceplate for mounting one keystone jack at a wall outlet.', keyFeatures: ['Clean, professional finish for network wall outlets', 'Compatible with standard keystone jacks', 'Easy installation on single-gang back boxes'] },
  'Dual Port Faceplate': { brand: 'Schneider', description: 'Dual port faceplate for mounting two keystone jacks at a single wall outlet.', keyFeatures: ['Supports two network or voice connections per outlet', 'Compatible with standard keystone jacks', 'Space-saving design for shared data/voice outlets'] },
  '4x4 Camera Junction Box': { brand: 'Dahua', description: '4x4 junction box for housing and protecting CCTV camera cable connections.', keyFeatures: ['Protects camera cable splices and connectors from damage', 'Standard 4x4 size fits common mounting locations', 'Suitable for indoor and outdoor camera installations'] },

  // HDMI & Display Accessories — HDMI Cables
  '1.5 Meter HDMI Cable': { brand: 'UGREEN', description: '1.5 meter HDMI cable for high-definition video and audio connections.', keyFeatures: ['Supports high-definition video and audio in a single cable', 'Gold-plated connectors for reliable signal transfer', 'Suitable for displays, monitors and AV equipment'] },
  '3 Meter HDMI Cable': { brand: 'UGREEN', description: '3 meter HDMI cable for high-definition video and audio connections.', keyFeatures: ['Supports high-definition video and audio in a single cable', 'Gold-plated connectors for reliable signal transfer', 'Suitable for displays, monitors and AV equipment'] },
  '5 Meter HDMI Cable': { brand: 'UGREEN', description: '5 meter HDMI cable for high-definition video and audio connections.', keyFeatures: ['Supports high-definition video and audio in a single cable', 'Gold-plated connectors for reliable signal transfer', 'Suitable for displays, monitors and AV equipment'] },
  '10 Meter HDMI Cable': { brand: 'UGREEN', description: '10 meter HDMI cable for high-definition video and audio connections over longer runs.', keyFeatures: ['Supports high-definition video and audio over longer runs', 'Gold-plated connectors for reliable signal transfer', 'Suitable for conference rooms and control room setups'] },
  '15 Meter HDMI Cable': { brand: 'UGREEN', description: '15 meter HDMI cable for high-definition video and audio connections over longer runs.', keyFeatures: ['Supports high-definition video and audio over longer runs', 'Gold-plated connectors for reliable signal transfer', 'Suitable for conference rooms and control room setups'] },
  '20 Meter HDMI Cable': { brand: 'UGREEN', description: '20 meter HDMI cable for high-definition video and audio connections over longer runs.', keyFeatures: ['Supports high-definition video and audio over long runs', 'Gold-plated connectors for reliable signal transfer', 'Suitable for auditoriums and large control room setups'] },

  // HDMI & Display Accessories — Video Accessories
  'HDMI Splitter': { brand: 'UGREEN', description: 'HDMI splitter for sending one HDMI source to multiple displays simultaneously.', keyFeatures: ['Sends one HDMI source to multiple displays at once', 'Simple plug-and-play setup', 'Ideal for presentations, control rooms and signage'] },
  'HDMI Extender': { brand: 'UGREEN', description: 'HDMI extender for running high-definition video beyond standard cable length limits.', keyFeatures: ['Extends HDMI signal well beyond standard cable range', 'Maintains high-definition video and audio quality', 'Suited for conference rooms and control room setups'] },
  'HDMI Switch': { brand: 'UGREEN', description: 'HDMI switch for connecting multiple HDMI sources to a single display.', keyFeatures: ['Connects multiple HDMI sources to one display', 'Simple manual or auto-switching between inputs', 'Reduces cable clutter around displays'] },

  // CCTV Accessories — Camera Mounts
  '1 Foot Stand': { brand: 'Hikvision', description: '1 foot camera mounting stand for elevated CCTV camera positioning.', keyFeatures: ['Provides stable elevated mounting for CCTV cameras', 'Compatible with standard camera mounting brackets', 'Durable construction for indoor and outdoor use'] },
  '2 Foot Stand': { brand: 'Dahua', description: '2 foot camera mounting stand for extended-height CCTV installations.', keyFeatures: ['Extended height for improved camera coverage angles', 'Compatible with standard camera mounting brackets', 'Durable construction for indoor and outdoor use'] },
  '4 Foot Stand': { brand: 'Uniview', description: '4 foot camera mounting stand for high-elevation CCTV camera placement.', keyFeatures: ['Tall mounting height for wide-area surveillance coverage', 'Compatible with standard camera mounting brackets', 'Sturdy build for long-term outdoor installation'] },
  'Wall Mount Bracket': { brand: 'Hikvision', description: 'Wall mount bracket for securely installing CCTV cameras on vertical surfaces.', keyFeatures: ['Secure wall mounting for bullet and dome cameras', 'Adjustable angle for optimal camera positioning', 'Weatherproof construction for outdoor use'] },
  'Pole Mount Bracket': { brand: 'Dahua', description: 'Pole mount bracket for installing CCTV cameras on poles and columns.', keyFeatures: ['Fits standard poles and columns for camera mounting', 'Adjustable positioning for optimal coverage', 'Durable weatherproof construction'] },
  'Pole Clamp': { brand: 'Uniview', description: 'Pole clamp for securing camera mounts and enclosures to poles.', keyFeatures: ['Secure clamping for pole-mounted camera equipment', 'Adjustable to fit various pole diameters', 'Weather-resistant for outdoor installation'] },

  // CCTV Accessories — Camera Protection
  'Weatherproof Junction Box': { brand: 'Dahua', description: 'Weatherproof junction box for protecting outdoor CCTV cable connections.', keyFeatures: ['Shields cable connections from rain and moisture', 'Durable outdoor-rated enclosure', 'Simplifies safe outdoor camera cable termination'] },
  'Outdoor Housing': { brand: 'Hikvision', description: 'Outdoor camera housing for protecting cameras in harsh weather conditions.', keyFeatures: ['Shields cameras from rain, dust and direct sunlight', 'Extends camera lifespan in outdoor environments', 'Compatible with standard mounting brackets'] },

  // CCTV Accessories — Storage
  'Surveillance HDD 1TB': { brand: 'Western Digital', description: '1TB surveillance-grade hard drive designed for 24/7 DVR and NVR recording.', keyFeatures: ['Optimized for DVR and NVR systems', 'Built for continuous 24/7 recording workloads', 'Reliable storage for CCTV video retention'] },
  'Surveillance HDD 2TB': { brand: 'Seagate', description: '2TB surveillance-grade hard drive designed for 24/7 DVR and NVR recording.', keyFeatures: ['Optimized for DVR and NVR systems', 'Built for continuous 24/7 recording workloads', 'Reliable storage for CCTV video retention'] },
  'Surveillance HDD 4TB': { brand: 'Western Digital', description: 'Surveillance-grade hard drive designed for 24/7 recording.', keyFeatures: ['Optimized for DVR and NVR systems', 'Reliable storage for CCTV video retention', 'Built for continuous 24/7 recording workloads'] },
  'Surveillance HDD 8TB': { brand: 'Seagate', description: '8TB surveillance-grade hard drive designed for 24/7 DVR and NVR recording.', keyFeatures: ['Optimized for DVR and NVR systems', 'Built for continuous 24/7 recording workloads', 'Extended capacity for longer video retention'] },
  'Surveillance HDD 10TB': { brand: 'Western Digital', description: '10TB surveillance-grade hard drive designed for 24/7 DVR and NVR recording.', keyFeatures: ['Optimized for DVR and NVR systems', 'Built for continuous 24/7 recording workloads', 'Maximum capacity for extended video retention'] }
};

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB...');

    let updated = 0;
    let notFound = 0;

    for (const [name, content] of Object.entries(DESCRIPTION_AND_BRAND_ONLY)) {
      const product = await Product.findOne({ name });
      if (!product) { console.log(`  NOT FOUND (skipped): ${name}`); notFound++; continue; }
      product.set({ brand: content.brand, description: content.description });
      await product.save();
      console.log(`  Updated (desc+brand only): ${name} -> ${content.brand}`);
      updated++;
    }

    for (const [name, content] of Object.entries(FULL_CONTENT)) {
      const product = await Product.findOne({ name });
      if (!product) { console.log(`  NOT FOUND (skipped): ${name}`); notFound++; continue; }
      product.set({ brand: content.brand, description: content.description, keyFeatures: content.keyFeatures });
      await product.save();
      console.log(`  Updated (full content): ${name} -> ${content.brand}`);
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
