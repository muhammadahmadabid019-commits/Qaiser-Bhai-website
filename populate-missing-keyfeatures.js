// One-off content script: fills in `keyFeatures` bullet lists for the
// products that were created without any (see the "missing keyFeatures"
// audit run during this pass). Bullets are derived from each product's own
// existing `description` field plus general category/brand knowledge —
// no invented per-SKU specs that aren't already stated on the record.
// Safe to re-run: only touches products with an empty keyFeatures array.
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const KEY_FEATURES = {
  'Crimping Tool (RJ45)': [
    'Terminates RJ45 connectors onto CAT5/CAT6 cable',
    'Klein Tools build quality for daily installer use',
    'Ratcheting mechanism for a consistent, secure crimp',
    'Essential hand tool for structured cabling work'
  ],
  'Cable Tester': [
    'Checks continuity and wiring faults on network/CCTV cable runs',
    'Fluke-grade accuracy for professional installs',
    'Quickly identifies open, shorted, or miswired pairs',
    'Speeds up troubleshooting on multi-run installations'
  ],
  'Wire Stripper': [
    'Precision stripping for coax and network cable jackets',
    'Stanley build quality for repeated daily use',
    'Clean strips reduce risk of damaging inner conductors',
    'Complements crimping tools in a cable installer kit'
  ],
  'Ladder (6ft Aluminum)': [
    'Lightweight aluminum construction, easy to carry between job sites',
    '6ft working height suited for camera and cable mounting work',
    'Stable footing for wall and ceiling installation tasks',
    'Standard toolkit item for CCTV and networking installers'
  ],
  'UPS 650VA': [
    'Uninterrupted backup power for routers and small devices',
    'APC reliability for continuous network uptime',
    'Automatic switchover during mains power loss',
    'Compact size for desk or small equipment cabinets'
  ],
  'UPS 1500VA': [
    'Higher-capacity backup power for NVR/DVR systems',
    'APC reliability for surveillance and network continuity',
    'Longer runtime than entry-level UPS units during outages',
    'Suited for small server or CCTV control rooms'
  ],
  'PoE Injector': [
    'Powers IP cameras over Ethernet — no separate power wiring needed',
    'TP-Link reliability for continuous PoE camera operation',
    'Simplifies installation in locations without nearby power outlets',
    'Compatible with standard 802.3af/at PoE IP cameras'
  ],
  'SMPS Power Supply (12V 5A)': [
    '12V 5A regulated output for CCTV camera setups',
    'CP Plus branded for consistent voltage delivery',
    'Compact switch-mode design, low heat output',
    'Suited for single or small multi-camera installations'
  ],
  '6U Wall Mount Rack': [
    'Compact 6U enclosure for small network setups',
    'Toten build quality with wall-mount fixing',
    'Space-efficient option for homes, offices, and small server rooms',
    'Keeps switches, patch panels, and routers organized and protected'
  ],
  'Cable Management Tray': [
    'Horizontal tray for organizing cables inside racks',
    'Toten build quality matched to standard rack widths',
    'Keeps patch cords tidy and reduces cable strain',
    'Improves airflow and serviceability inside the rack'
  ],
  '42U Floor Standing Rack': [
    'Full-size 42U cabinet for large-scale server/network rooms',
    'Legrand build quality for enterprise deployments',
    'Floor-standing design accommodates extensive equipment loads',
    'Supports structured cabling, switches, and server hardware together'
  ],
  'Rack PDU (Power Distribution Unit)': [
    'Distributes power to multiple rack-mounted devices',
    'APC reliability for data center and server room use',
    'Consolidates power management within the rack footprint',
    'Reduces cable clutter versus individual wall outlets'
  ],
  'Hikvision DS-2CE16C0T-IRP': [
    '1MP CMOS analog HD bullet camera, up to 720P resolution',
    'True day/night mode with Smart IR up to 20m range',
    'Digital Noise Reduction (DNR) for clearer low-light footage',
    'IP66-rated weatherproof housing for outdoor installation'
  ],
  'Dahua DH-HAC-B1A21': [
    '2MP HD/SD switchable analog camera',
    '3.6mm fixed lens (6mm optional) for flexible field of view',
    'Smart IR with range up to 20m for night visibility',
    'IP67-rated housing for reliable outdoor use'
  ],
  'Dahua HAC-HFW1500CL-IL-A': [
    'Dahua HD analog camera for CCTV surveillance systems',
    'Suited for standard indoor/outdoor security monitoring',
    'Compatible with existing Dahua HDCVI DVR systems',
    'Durable housing built for continuous operation'
  ],
  'HDMI to VGA Converter': [
    'Converts digital HDMI signal to analog VGA output',
    'Compatible with PCs, DVD players, and game consoles',
    'Supports 720P/1080P output resolution',
    'Powered directly through the HDMI port — no external adapter needed'
  ],
  'VGA to HDMI Adapter': [
    'Converts VGA + audio input into an HDMI output',
    '15-pin VGA female port plus 3.5mm stereo audio input',
    'Supports full HD resolution up to 1920×1080',
    'Host-powered via onboard active DAC chip'
  ],
  'USB-C to HDMI Adapter Cable (Model 70444)': [
    'UGREEN aluminum-body USB-C to HDMI adapter',
    'Supports 4K at 60Hz output',
    'Thunderbolt 3/4 compatible',
    'Works with MacBooks, iPads, and USB-C-enabled phones'
  ],
  'BNC Connector Twist-Spring Jack': [
    'Solderless BNC male connector for CCTV coax cable',
    'Twist-spring termination — no crimping tool required',
    'Installs with just a small screwdriver',
    'Quick, secure coax connection for camera-to-DVR runs'
  ],
  'RJ45 Coupler': [
    'Female-to-female coupler for joining two Ethernet cables',
    'Supports up to 100Mbps data transfer',
    'Compatible with CAT5/CAT5e and CAT6 cable',
    'Gold-plated contacts for reliable signal transfer'
  ],
  'BNC Connector for CCTV Cameras (Pack of 4)': [
    'Screw-type BNC male connectors for CCTV coax cable',
    'Sold in packs of four for multi-camera installs',
    'Terminates RG59/RG6 cable ends',
    'Connects cameras to DVRs with a secure screw-lock fit'
  ],
  'BNC Male Connector': [
    'Copper-plated BNC plug with gold-plated pin',
    'Suited for audio, video, and networking applications',
    'Snap-lock design keeps the plug firmly seated',
    'MX build quality for reliable coax connections'
  ],
  'BNC Connector Video Extension Cable': [
    '1 meter BNC male plug video extension cable',
    'Coaxial extension for CCTV camera/DVR connections',
    'Quick way to extend a run without re-terminating cable ends',
    'Standard coax connector fit for existing CCTV installs'
  ],
  'DC Power Jack Male & Female Pair': [
    'Solderless DC power jack pair (male and female)',
    '5.5mm x 2.1mm size, standard for CCTV and LED strip power',
    'No crimping tool needed — installs with just a screwdriver',
    'Quick, secure connection for camera power runs'
  ],
  'DC Power Connector Bulk Pack': [
    'Bulk pack of 20 pairs of 12V DC power jack connectors',
    '2.1mm x 5.5mm size for CCTV cameras and LED strip lighting',
    'Solderless, screwdriver-only installation',
    'Ideal for installers handling multiple jobs at once'
  ],
  '12V 7Ah Rechargeable UPS Battery': [
    'Maintenance-free VRLA (sealed lead-acid) rechargeable battery',
    'Leak-proof sealed design for safe indoor placement',
    'Suited for UPS units, DVR/NVR backup, solar, and alarm systems',
    'Green Electric build quality for stable backup power'
  ],
  '12V 7Ah Dry Battery': [
    'Compact dry battery for UPS and small backup systems',
    'Osaka build, a budget-friendly backup option',
    'Suited for basic CCTV/DVR backup needs',
    'Common form factor also used in bikes and small inverters'
  ],
  'Mini UPS Battery Backup': [
    'Compact 12V 2A DC-to-DC battery backup unit',
    'Keeps routers, modems, CCTV cameras, and DVRs running during outages',
    'Lightweight, easy to install near existing equipment',
    'Multi-purpose — not limited to a single device type'
  ],
  '12V 18Ah UPS/CCTV Battery': [
    'Mid-capacity sealed lead-acid battery for longer backup runtimes',
    'Suited for multi-camera CCTV setups or small UPS systems',
    'Osaka build quality for sustained power delivery',
    'More capacity than standard 7Ah batteries for extended coverage'
  ],
  'CCTV Power Supply SMPS': [
    'Branded Hikvision SMPS with stable 12V DC 5A output',
    'Built for compatibility and durability with Hikvision cameras',
    'Consistent voltage delivery for reliable camera operation',
    'Recommended pairing for Hikvision CCTV installations'
  ],
  '12V 10A Regulated CCTV Power Supply': [
    'Higher-current 12V 10A output for larger camera setups (8+ cameras)',
    'Tighter voltage regulation than basic unregulated units',
    'Recommended for long-term reliability over cheaper alternatives',
    'Suited for multi-camera installations on a single supply'
  ],
  '12V 5A DC SMPS (Multipurpose)': [
    'Multipurpose 12V 5A switch-mode DC power supply',
    'Built-in overload protection',
    'General-purpose unit for a wide range of devices',
    'Not limited to CCTV — suits routers, LEDs, and small electronics'
  ],
  'Industrial 12V 10A SMPS (Enclosed/DIN Rail)': [
    'Heavy-duty enclosed SMPS rated 12V 10A',
    'DIN rail mountable for industrial/commercial installs',
    'Built for continuous, round-the-clock operation',
    'Suited for combined CCTV, access control, and networking loads'
  ],
  'CAT6 Outdoor Double Jacket Cable': [
    'Outdoor-rated Cat6 UTP cable with double PVC+PE jacket',
    'CCA (copper-clad aluminum) 23AWG conductor',
    'HDPE insulation for weatherproof outdoor runs',
    'Suited for long-distance CCTV and network cable installs'
  ],
  'CAT6 Cable (24AWG, 4 Pair, 305m/Box)': [
    'Premium-grade Cat6 UTP cable, 24AWG 4-pair construction',
    'Corning branded for certified performance',
    '305m box — standard bulk packaging for installers',
    'Suited for enterprise and commercial cabling projects'
  ],
  'UPVC Electrical Conduit Pipe (20mm/25mm)': [
    'Rigid UPVC conduit for routing and protecting cabling',
    'Standard 20mm/25mm sizes for residential and commercial wiring',
    'Protects network and electrical cable runs inside walls/ceilings',
    'Durable, non-conductive housing for concealed installations'
  ],
  'PVC Cable Duct/Trunking Channel': [
    'Wall-mounted trunking that covers and protects cable runs',
    'Hides unattractive wiring from view',
    'Prevents accidental damage to network/electrical cables',
    'Simple surface-mount installation'
  ],
  'Flexible PVC Conduit Pipe': [
    'Flexible corrugated conduit for tight spaces or curved paths',
    'Complements rigid conduit in a full cable-protection setup',
    'Commonly used for CCTV and network cable protection',
    'Eases routing around obstacles during installation'
  ],
  'Single-Mode Fiber Cable': [
    'Single-mode outdoor fiber cable with dual protective sheath',
    'GYFTY build for long-distance high-speed data transmission (10km+)',
    'Suited for ISP and enterprise backbone applications',
    'Priced and supplied per meter'
  ],
  'Multimode Indoor Fiber Optic Cable': [
    'Indoor-rated multimode fiber for shorter-distance data links',
    'Lower cost than single-mode for local network runs',
    'Suited for in-building or campus network connections',
    'Priced and supplied per meter'
  ],
  'CAT6 UTP 24-Port Patch Panel': [
    'Cat6 UTP patch panel with RJ45 connectors',
    'Digilink build rated for 750 mating cycles',
    '500 mOhm contact resistance for reliable connections',
    'Mid-range option for structured cabling racks'
  ],
  'CAT5E 24-Port UTP Patch Panel': [
    '24-port (1U) Cat5E UTP patch panel',
    'Six-port RJ45 modules pre-applied',
    'ID stripes for easy port allocation and cable management',
    'Budget-friendly option for basic network installations'
  ],
  'RJ45/RJ11 Network Cable Tester (LCD Display)': [
    'Master and remote unit cable tester with RJ11 and RJ45 inputs',
    'Sequential LED indicators detect open circuits and short faults',
    'Identifies disordered wiring in twisted-pair cables',
    'Essential diagnostic tool for network installers'
  ],
  'USB LAN Cable Tracker & Tester': [
    'Compact tester with built-in tracker/detector function',
    'Locates and verifies UTP LAN cable runs',
    'Useful for tracing cables in larger, complex installations',
    'USB-powered for portable use on site'
  ],
  'Fiber Optic Cable Stripper/Cutter': [
    'Dedicated stripping tool for fiber optic cable jackets',
    'Removes Kevlar strength members cleanly before termination',
    'Prepares fiber ends for splicing or connectorization',
    'Essential tool for fiber installation work'
  ],
  'Fiber Optic Visual Fault Locator (VFL) Pen': [
    'Handheld laser pen for visually tracing fiber faults',
    'Detects breaks, bends, and faulty connectors',
    'Shines visible red light through the fiber core',
    'Quick, no-equipment-needed fiber troubleshooting'
  ],
  'BNC Connector Crimping/Termination Tool': [
    'Dedicated crimping tool for BNC connector termination',
    'Works with RG59/RG6 coaxial cable for CCTV video runs',
    'Produces a secure, reliable coax termination',
    'Standard tool for CCTV installer kits'
  ],
  'Punch-Down Tool (110/Krone Blade)': [
    'Spring-loaded punch-down tool for Cat5e/Cat6 termination',
    'Terminates cable onto patch panels and keystone jacks',
    'Compatible with both 110 and Krone punch-down standards',
    'Standard tool for structured cabling installers'
  ],
  'CCTV Camera Housing IP66': [
    'IP66-rated metal housing cover for IR waterproof cameras',
    'HSmart HD build for outdoor durability',
    'Protects camera body from dust and moisture',
    'Suited for outdoor CCTV installations'
  ],
  'Outdoor CCTV Metal Housing': [
    'Aluminum bracket and waterproof casing',
    'Compact design fits cameras up to 14 inches',
    'Weatherproof protection for outdoor camera installs',
    'Durable metal construction for long-term outdoor use'
  ],
  'Metal CCTV Wall Ceiling Bracket (Heavy Duty)': [
    'Heavy-duty metal wall/ceiling mounting bracket',
    'Adjustable installation angles for flexible camera positioning',
    'Durable, stable support for CCTV camera bodies',
    'Suited for both indoor and outdoor mounting'
  ],
  '12V 2A Waterproof DC Power Adapter (CCTV)': [
    'Weatherproof 12V 2A DC power supply for outdoor cameras',
    'GSS build quality for reliable outdoor operation',
    '5.5mm x 2.5mm output jack, standard CCTV camera fit',
    'Sealed design protects against moisture ingress'
  ],
  '4-Channel Multi-Output CCTV Power Adapter': [
    'Single AC outlet powers up to four cameras',
    'Regulated 12V DC output via 2.1mm barrel plugs',
    'Simplifies power wiring for multi-camera installs',
    'Reduces the number of individual adapters needed'
  ],
  'Waterproof PVC Junction Box (4"x4", IP65)': [
    'IP65-rated weatherproof outdoor junction box',
    'Hides camera connectors and power supply from view',
    'Rubber-covered cable entry holes prevent water/insect ingress',
    'Standard 4"x4" size for single-camera connection points'
  ],
  'Large CCTV Distribution Junction Box (6"x6")': [
    'Larger-format junction box for consolidating connections',
    'Houses multiple camera splitters or DVR/NVR wiring',
    'Central outdoor connection point for multi-camera systems',
    'Weatherproof housing for reliable outdoor use'
  ],
  'Varifocal CCTV Lens (2.8-12mm, CS Mount)': [
    'Manually adjustable varifocal lens, 2.8-12mm zoom range',
    'CS-mount fit for most IP/AHD cameras',
    'Allows on-site zoom and focus adjustment for ideal coverage',
    'Honeywell-compatible for easy sourcing/replacement'
  ],
  'Fisheye CCTV Lens': [
    'Ultra-wide fisheye lens for 180-degree panoramic coverage',
    'Suited for single-camera full-room monitoring',
    'Reduces the number of cameras needed for open spaces',
    'Wide field of view ideal for retail and lobby areas'
  ],
  'Universal LCD/LED TV Wall Bracket': [
    'Slim, fixed universal wall mount for 32" to 55" TVs',
    'Standard fixed installation for flat wall surfaces',
    'Low-profile design keeps the TV close to the wall',
    'Straightforward mounting for most LCD/LED models'
  ],
  'Single Arm Articulating TV Mount (32"–55")': [
    'Single-arm extendable mount for 32" to 55" TVs',
    'Allows the TV to swing out for angled viewing',
    'Suited for rooms where direct front-facing mounting isn\'t ideal',
    'Adjustable positioning after installation'
  ],
  'HDMI Splitter 1x4 (4 Port)': [
    'Splits one HDMI 1.4 input to four HDMI sink devices',
    'HDCP 1.2 compliant',
    'Supports 30-bit/36-bit deep color and full 3D',
    'Black Copper build for multi-display setups'
  ],
  'HDMI Extender via CAT5e/6 Cable': [
    'Extends HDMI signal up to 30 meters using UTP cable',
    'Supports full 1080p resolution over the extended run',
    'Breaks past standard HDMI cable length limitations',
    'Low-cost alternative to long run HDMI cables'
  ],
  'Fiber Media Converter (SC, Single-Mode, 20km)': [
    'Converts fiber optic signal to Ethernet (RJ45) and back',
    'Single-mode SC connector, rated up to 20km',
    'Extends network connections beyond copper cable distance limits',
    'Standard building block for fiber backbone links'
  ],
  'GPON ONU/ONT Router (Fiber Terminal)': [
    'Huawei optical network terminal for GPON fiber connections',
    'Converts incoming fiber signal into usable Ethernet/WiFi',
    'Commonly deployed by ISPs for FTTH (fiber-to-the-home)',
    'End-user premises fiber termination device'
  ],
  'TL-SG1005D 5-Port Gigabit Desktop Switch': [
    '5-port Gigabit desktop switch',
    'TP-Link plug-and-play setup, no configuration required',
    'Compact plastic desktop case',
    'Suited for small home or office network expansion'
  ],
  'Cube 2MP WiFi Indoor Camera': [
    '1080P WiFi indoor camera using H.265 compression',
    'Cuts bandwidth and storage use by up to 50% at the same quality',
    'PIR motion detection with smartphone notifications',
    'Sound detection for baby crying or abnormal noises, plus alarm I/O port'
  ],
  'DS-2CV2U01EFD-IW (1MP Mini IP/WiFi Camera)': [
    'Compact Hikvision mini IP camera, dual-stream output',
    'Built-in microphone and speaker for two-way audio',
    '3D DNR noise reduction for clearer footage',
    'One of the most budget-friendly Hikvision IP models available'
  ],
  '42U wall-mount network rack': [
    '42U wall-mount rack in cold-rolled steel construction',
    'Black powder-coat finish with lockable glass front door',
    'Vented side/rear panels for equipment airflow',
    'Built-in cable management support'
  ],
  '27U 4-Post Open Frame Rack': [
    '27U 4-post open frame rack',
    '600mm width, standard equipment fit',
    'Floor-standing with leveling feet for stability',
    'Open-frame design for easy access and airflow'
  ]
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  let updated = 0, notFound = 0;
  for (const [name, keyFeatures] of Object.entries(KEY_FEATURES)) {
    const product = await Product.findOne({ name });
    if (!product) {
      notFound++;
      console.warn(`No product found matching name: "${name}"`);
      continue;
    }
    if (product.keyFeatures && product.keyFeatures.length > 0) continue; // already has some, skip
    product.keyFeatures = keyFeatures;
    await product.save();
    updated++;
  }

  console.log({ updated, notFound, totalMapped: Object.keys(KEY_FEATURES).length });
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
