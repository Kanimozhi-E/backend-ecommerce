const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Review = require('../models/Review');

const seedData = async () => {
  try {
    await connectDB();

    console.log('[Nebula Prime Seeder] Clearing old store data...');
    await User.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();
    await Coupon.deleteMany();
    await Review.deleteMany();

    console.log('[Nebula Prime Seeder] Creating users...');
    const admin = await User.create({
      name: 'Nebula Administrator',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin',
      phone: '+91 9876543210',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      addresses: [
        {
          fullName: 'Nebula Headquarters',
          phone: '+91 9876543210',
          street: '100 Innovation Parkway, Tech Enclave',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          country: 'India',
          isDefault: true
        }
      ]
    });

    const customer = await User.create({
      name: 'John Doe',
      email: 'customer@example.com',
      password: 'password123',
      role: 'customer',
      phone: '+91 9123456789',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      addresses: [
        {
          fullName: 'John Doe',
          phone: '+91 9123456789',
          street: '42 Cyber City, MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560025',
          country: 'India',
          isDefault: true
        }
      ]
    });

    console.log('[Nebula Prime Seeder] Creating categories...');
    const categories = await Category.insertMany([
      {
        name: 'Audio & Acoustics',
        slug: 'audio-acoustics',
        description: 'High-fidelity wireless studio monitors, spatial ANC headphones, and immersive speakers.',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80'
      },
      {
        name: 'Computers & Laptops',
        slug: 'computers-laptops',
        description: 'Next-gen M-Series OLED ultrabooks, AI workstations, and creative powerhouses.',
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80'
      },
      {
        name: 'Smart Wearables',
        slug: 'smart-wearables',
        description: 'Titanium biometric smartwatches, health trackers, and continuous SpO2 monitors.',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80'
      },
      {
        name: 'Electronics & Gear',
        slug: 'electronics-gear',
        description: '4K cinematic cameras, tactile RGB mechanical keyboards, and precision peripherals.',
        image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80'
      }
    ]);

    const catMap = {};
    categories.forEach(c => (catMap[c.name] = c._id));

    console.log('[Nebula Prime Seeder] Creating curated 4K product catalog...');
    const products = await Product.insertMany([
      {
        title: 'Nebula SoundCraft Pro ANC Headphones',
        slug: 'nebula-soundcraft-pro-anc-headphones',
        description: 'Engineered with custom 40mm beryllium drivers, hybrid Active Noise Cancellation (-42dB), spatial audio head tracking, and up to 45 hours of ultra-low latency wireless playback.',
        price: 299,
        discountPrice: 249,
        category: catMap['Audio & Acoustics'],
        stock: 45,
        rating: 4.9,
        numReviews: 38,
        isFeatured: true,
        brand: 'Nebula Acoustics',
        tags: ['headphones', 'wireless', 'anc', 'audio', 'noise cancelling', 'bluetooth', 'soundcraft'],
        specifications: {
          'Battery Life': '45 Hours ANC On',
          'Driver Size': '40mm Beryllium',
          'ANC Depth': '-42dB Hybrid',
          'Weight': '250g'
        },
        images: [
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80'
        ],
        variants: [
          {
            name: 'Color: Midnight Obsidian',
            priceOffset: 0,
            stock: 25,
            image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'
          },
          {
            name: 'Color: Platinum Silver',
            priceOffset: 10,
            stock: 20,
            image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80'
          }
        ],
        seller: admin._id
      },
      {
        title: 'Nebula Blade 16 Ultra OLED Workstation Laptop',
        slug: 'nebula-blade-16-ultra-oled-workstation-laptop',
        description: 'Uncompromising power housed in a CNC-milled magnesium chassis. Equipped with 14-Core Neural Engine, 32GB LPDDR5X RAM, 1TB PCIe Gen4 SSD, and a 120Hz 4K OLED HDR Touch display.',
        price: 1499,
        discountPrice: 1299,
        category: catMap['Computers & Laptops'],
        stock: 15,
        rating: 4.9,
        numReviews: 48,
        isFeatured: true,
        brand: 'Nebula Systems',
        tags: ['laptop', 'computer', 'oled', 'ultrabook', 'workstation', 'programming', 'code', 'blade'],
        specifications: {
          'Processor': '14-Core AI Chipset',
          'RAM': '32GB LPDDR5X',
          'Display': '16" 4K OLED 120Hz',
          'Storage': '1TB NVMe SSD'
        },
        images: [
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80'
        ],
        variants: [
          {
            name: 'Specification: 32GB RAM / 1TB SSD (Space Gray)',
            priceOffset: 0,
            stock: 10,
            image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80'
          },
          {
            name: 'Specification: 64GB RAM / 2TB SSD (Silver Edition)',
            priceOffset: 300,
            stock: 5,
            image: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80'
          }
        ],
        seller: admin._id
      },
      {
        title: 'Nebula Horizon Sapphire Edition Smartwatch',
        slug: 'nebula-horizon-sapphire-edition-smartwatch',
        description: 'Aerospace-grade titanium casing with dual-frequency GPS, optical ECG, continuous SpO2 health tracking, and Sapphire Crystal touch screen resistant to extreme impacts.',
        price: 349,
        discountPrice: 299,
        category: catMap['Smart Wearables'],
        stock: 30,
        rating: 4.8,
        numReviews: 32,
        isFeatured: true,
        brand: 'Nebula Wear',
        tags: ['smartwatch', 'wearable', 'watch', 'gps', 'titanium', 'fitness', 'horizon', 'spO2'],
        specifications: {
          'Material': 'Grade 5 Titanium & Sapphire',
          'Battery': '7 Days Active Use',
          'Water Resistance': '100m (10 ATM)',
          'Sensors': 'ECG, SpO2, Dual GPS'
        },
        images: [
          'https://images.unsplash.com/photo-1544117519-31a4b719223d?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'
        ],
        variants: [
          {
            name: 'Strap Option: Titanium Ocean Gray',
            priceOffset: 0,
            stock: 18,
            image: 'https://images.unsplash.com/photo-1544117519-31a4b719223d?auto=format&fit=crop&w=800&q=80'
          },
          {
            name: 'Strap Option: Sport Silicone Black',
            priceOffset: -20,
            stock: 12,
            image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'
          }
        ],
        seller: admin._id
      },
      {
        title: 'Nebula PulseFit Pro Fitness Band',
        slug: 'nebula-pulsefit-pro-fitness-band',
        description: 'Ultra-lightweight curved AMOLED fitness tracker with 24/7 heart rate monitoring, stress tracking, 14-day battery endurance, and 50+ professional workout modes.',
        price: 89,
        discountPrice: 69,
        category: catMap['Smart Wearables'],
        stock: 50,
        rating: 4.7,
        numReviews: 29,
        isFeatured: false,
        brand: 'Nebula Wear',
        tags: ['smartwatch', 'fitness', 'band', 'wearable', 'health', 'watch', 'pulsefit'],
        specifications: {
          'Screen': '1.47" Curved AMOLED',
          'Battery': '14 Days Typical',
          'Waterproof': '5 ATM',
          'Weight': '18g'
        },
        images: [
          'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=800&q=80'
        ],
        variants: [
          {
            name: 'Color: Matte Black Band',
            priceOffset: 0,
            stock: 30,
            image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=800&q=80'
          }
        ],
        seller: admin._id
      },
      {
        title: 'Nebula KeyCraft RGB Mechanical Keyboard',
        slug: 'nebula-keycraft-rgb-mechanical-keyboard',
        description: 'Custom hot-swappable mechanical keyboard featuring sound-dampening gasket mount, per-key RGB backlight lighting, and aircraft-grade aluminum top plate.',
        price: 129,
        discountPrice: 99,
        category: catMap['Electronics & Gear'],
        stock: 40,
        rating: 4.8,
        numReviews: 41,
        isFeatured: false,
        brand: 'Nebula Gear',
        tags: ['keyboard', 'gaming', 'rgb', 'mechanical', 'accessories', 'keycraft'],
        specifications: {
          'Switch Type': 'Gateron Pro Yellow',
          'Connectivity': 'Tri-Mode (BT / 2.4G / Type-C)',
          'Mounting': 'Gasket Mount',
          'Frame': 'Aluminum Alloy'
        },
        images: [
          'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80'
        ],
        variants: [
          {
            name: 'Color Edition: Cyber Black Gasket',
            priceOffset: 0,
            stock: 20,
            image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80'
          },
          {
            name: 'Color Edition: Chrono White Edition',
            priceOffset: 0,
            stock: 20,
            image: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80'
          }
        ],
        seller: admin._id
      },
      {
        title: 'Nebula CinemaPro 4K Mirrorless Camera',
        slug: 'nebula-cinemapro-4k-mirrorless-camera',
        description: 'Capture broadcast-grade 4K 60fps video with full-frame BSI sensor, 693-point AI subject tracking, in-body 5-axis IBIS, and weather-sealed mag-alloy body.',
        price: 1899,
        discountPrice: 1699,
        category: catMap['Electronics & Gear'],
        stock: 10,
        rating: 4.9,
        numReviews: 22,
        isFeatured: true,
        brand: 'Nebula Optics',
        tags: ['camera', '4k', 'photography', 'video', 'mirrorless', 'cinemapro'],
        specifications: {
          'Sensor': '33MP Full-Frame BSI',
          'Video': '4K 60p 10-Bit 4:2:2',
          'Stabilization': '5-Axis In-Body IBIS',
          'Autofocus': '693 AI Tracking Points'
        },
        images: [
          'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80'
        ],
        variants: [
          {
            name: 'Package: Body Only (Obsidian Black)',
            priceOffset: 0,
            stock: 6,
            image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80'
          },
          {
            name: 'Package: Kit with 24-70mm f/2.8 Pro Lens',
            priceOffset: 600,
            stock: 4,
            image: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80'
          }
        ],
        seller: admin._id
      },
      {
        title: 'Nebula Wave 360 Portable Bluetooth Speaker',
        slug: 'nebula-wave-360-portable-bluetooth-speaker',
        description: 'Immersive 360-degree acoustic sound powered by dual passive radiators, IP67 dust/waterproof rating, 24-hour battery life, and party stereo pairing mode.',
        price: 89,
        discountPrice: 74,
        category: catMap['Audio & Acoustics'],
        stock: 55,
        rating: 4.6,
        numReviews: 26,
        isFeatured: false,
        brand: 'Nebula Acoustics',
        tags: ['speaker', 'bluetooth', 'audio', 'waterproof', 'portable', 'wave360'],
        specifications: {
          'Output Power': '30W RMS',
          'Playtime': '24 Hours',
          'Waterproof Rating': 'IP67 Submersible',
          'Wireless': 'Bluetooth 5.3'
        },
        images: [
          'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80'
        ],
        variants: [
          {
            name: 'Color: Navy Blue Edition',
            priceOffset: 0,
            stock: 30,
            image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80'
          },
          {
            name: 'Color: Charcoal Black',
            priceOffset: 0,
            stock: 25,
            image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80'
          }
        ],
        seller: admin._id
      }
    ]);

    console.log('[Nebula Prime Seeder] Creating coupons...');
    await Coupon.create({
      code: 'WELCOME20',
      discountType: 'percentage',
      discountValue: 20,
      minOrderAmount: 100,
      maxDiscount: 100,
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true
    });

    await Coupon.create({
      code: 'FLAT50',
      discountType: 'fixed',
      discountValue: 50,
      minOrderAmount: 200,
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true
    });

    console.log('[Nebula Prime Seeder] Creating genuine customer reviews...');
    await Review.create({
      user: customer._id,
      product: products[0]._id,
      userName: customer.name,
      rating: 5,
      comment: 'The active noise cancellation on the Nebula SoundCraft Pro is unmatched! Battery life easily lasts 4-5 days of heavy commuting.',
      verifiedPurchase: true
    });

    console.log('✅ [Nebula Prime Seeder] Database successfully seeded with NEBULA PRIME catalog!');
    console.log('Demo Credentials:');
    console.log(' - Customer: customer@example.com / password123');
    console.log(' - Admin:    admin@example.com / admin123');

    if (process.argv[2] === 'exit') {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ [Seeder Error]:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedData();
}

module.exports = seedData;
