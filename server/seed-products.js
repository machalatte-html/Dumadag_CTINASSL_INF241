import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { Product, Category } from './models.js';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not configured.');
  process.exit(1);
}

const catalog = {
  'Graphics Cards': [
    {
      name: 'GeForce RTX 4070 SUPER 12GB',
      brand: 'NVIDIA',
      price: 599,
      stock: 8,
      description: 'A high-performance graphics card for detailed 1440p gaming and creative work.',
      image:
        'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=900&q=85',
      specs: { Memory: '12GB GDDR6X', Interface: 'PCIe 4.0' },
    },
    {
      name: 'Radeon RX 7800 XT 16GB',
      brand: 'AMD',
      price: 499,
      stock: 7,
      description: 'A powerful 16GB graphics card designed for high-refresh 1440p gaming.',
      image:
        'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=85',
      specs: { Memory: '16GB GDDR6', Interface: 'PCIe 4.0' },
    },
    {
      name: 'GeForce RTX 4060 8GB',
      brand: 'NVIDIA',
      price: 299,
      stock: 12,
      description:
        'Efficient graphics performance for compact gaming and everyday creative builds.',
      image:
        'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=900&q=85',
      specs: { Memory: '8GB GDDR6', Interface: 'PCIe 4.0' },
    },
  ],
  Processors: [
    {
      name: 'Ryzen 7 7800X3D',
      brand: 'AMD',
      price: 369,
      stock: 11,
      description: 'An eight-core desktop processor with 3D V-Cache for responsive gaming builds.',
      image:
        'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=900&q=85',
      specs: { Cores: '8', Socket: 'AM5' },
    },
    {
      name: 'Core i7-14700K',
      brand: 'Intel',
      price: 389,
      stock: 6,
      description:
        'A versatile unlocked processor for demanding gaming, creation, and multitasking.',
      image:
        'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=900&q=85',
      specs: { Cores: '20', Socket: 'LGA 1700' },
    },
    {
      name: 'Ryzen 5 7600',
      brand: 'AMD',
      price: 199,
      stock: 15,
      description:
        'A power-efficient six-core processor for balanced AM5 gaming and productivity systems.',
      image:
        'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=900&q=85',
      specs: { Cores: '6', Socket: 'AM5' },
    },
  ],
  Memory: [
    {
      name: 'Vengeance 32GB DDR5 6000',
      brand: 'Corsair',
      price: 99,
      stock: 20,
      description: 'A low-latency 32GB DDR5 kit for modern desktop gaming and everyday workloads.',
      image:
        'https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=900&q=85',
      specs: { Capacity: '32GB', Speed: '6000MT/s' },
    },
    {
      name: 'Ripjaws S5 64GB DDR5 6000',
      brand: 'G.Skill',
      price: 189,
      stock: 9,
      description: 'A 64GB dual-channel memory kit for larger projects and demanding multitasking.',
      image:
        'https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=900&q=85',
      specs: { Capacity: '64GB', Speed: '6000MT/s' },
    },
    {
      name: 'Pro 32GB DDR5 5600',
      brand: 'Crucial',
      price: 79,
      stock: 16,
      description:
        'A dependable 32GB DDR5 kit for a straightforward productivity or gaming upgrade.',
      image:
        'https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=900&q=85',
      specs: { Capacity: '32GB', Speed: '5600MT/s' },
    },
  ],
  Storage: [
    {
      name: '990 PRO 2TB NVMe SSD',
      brand: 'Samsung',
      price: 169,
      stock: 14,
      description: 'Fast PCIe 4.0 storage for large game libraries and creative project files.',
      image:
        'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=85',
      specs: { Capacity: '2TB', Interface: 'PCIe 4.0' },
    },
    {
      name: 'Black SN850X 1TB NVMe SSD',
      brand: 'WD',
      price: 99,
      stock: 13,
      description: 'Responsive 1TB NVMe storage for quick game loads and everyday desktop use.',
      image:
        'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=85',
      specs: { Capacity: '1TB', Interface: 'PCIe 4.0' },
    },
    {
      name: 'P3 Plus 2TB NVMe SSD',
      brand: 'Crucial',
      price: 119,
      stock: 10,
      description: 'A spacious PCIe 4.0 drive for expanding a PC game and application library.',
      image:
        'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=85',
      specs: { Capacity: '2TB', Interface: 'PCIe 4.0' },
    },
  ],
  Motherboards: [
    {
      name: 'MAG B650 TOMAHAWK WIFI',
      brand: 'MSI',
      price: 219,
      stock: 5,
      description:
        'An AM5 ATX motherboard with Wi-Fi 6E and connectivity for a capable Ryzen build.',
      image:
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85',
      specs: { Socket: 'AM5', Form: 'ATX' },
    },
    {
      name: 'TUF GAMING B760-PLUS WIFI',
      brand: 'ASUS',
      price: 189,
      stock: 6,
      description:
        'A durable Intel ATX platform with integrated Wi-Fi for a flexible desktop build.',
      image:
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85',
      specs: { Socket: 'LGA 1700', Form: 'ATX' },
    },
    {
      name: 'B650 AORUS ELITE AX',
      brand: 'Gigabyte',
      price: 209,
      stock: 4,
      description: 'A feature-rich AM5 board with Wi-Fi and room for future system upgrades.',
      image:
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85',
      specs: { Socket: 'AM5', Form: 'ATX' },
    },
  ],
  'Power Supplies': [
    {
      name: 'RM850e 850W Gold PSU',
      brand: 'Corsair',
      price: 119,
      stock: 9,
      description: 'A quiet, fully modular 850W power supply with 80 PLUS Gold efficiency.',
      image:
        'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=85',
      specs: { Wattage: '850W', Rating: '80 PLUS Gold' },
    },
    {
      name: 'FOCUS GX-750 750W PSU',
      brand: 'Seasonic',
      price: 109,
      stock: 7,
      description: 'A fully modular 750W power supply for clean, efficient desktop builds.',
      image:
        'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=85',
      specs: { Wattage: '750W', Rating: '80 PLUS Gold' },
    },
    {
      name: 'Pure Power 12 M 850W PSU',
      brand: 'be quiet!',
      price: 139,
      stock: 6,
      description: 'An 850W modular power supply designed for quiet operation and modern systems.',
      image:
        'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=85',
      specs: { Wattage: '850W', Rating: '80 PLUS Gold' },
    },
  ],
  Cases: [
    {
      name: 'North Mid Tower Case',
      brand: 'Fractal Design',
      price: 149,
      stock: 4,
      description: 'A distinctive mid tower with a front mesh design and generous building space.',
      image:
        'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=900&q=85',
      specs: { Form: 'ATX', Color: 'Charcoal' },
    },
    {
      name: 'H5 Flow Mid Tower Case',
      brand: 'NZXT',
      price: 95,
      stock: 8,
      description: 'An airflow-focused mid tower with a clean layout for accessible PC building.',
      image:
        'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=900&q=85',
      specs: { Form: 'ATX', Color: 'Black' },
    },
    {
      name: '4000D AIRFLOW Mid Tower',
      brand: 'Corsair',
      price: 104,
      stock: 7,
      description: 'A practical mid tower with a high-airflow front panel and flexible interior.',
      image:
        'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=900&q=85',
      specs: { Form: 'ATX', Color: 'Black' },
    },
  ],
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const toPesos = (usd) => Math.round((usd * 63.825) / 50) * 50;

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  let added = 0;
  for (const [categoryName, candidates] of Object.entries(catalog)) {
    const category = await Category.findOne({ name: categoryName });
    if (!category) throw new Error(`Missing category: ${categoryName}. Run npm run db:init first.`);
    let activeCount = await Product.countDocuments({ category: category._id, active: true });
    for (const item of candidates) {
      if (activeCount >= 3) break;
      if (await Product.exists({ category: category._id, name: item.name, active: true })) continue;
      await Product.create({
        ...item,
        price: toPesos(item.price),
        currency: 'PHP',
        category: category._id,
        slug: `${slugify(item.name)}-${randomBytes(3).toString('hex')}`,
        featured: false,
        active: true,
      });
      activeCount += 1;
      added += 1;
    }
    console.log(`${categoryName}: ${activeCount} active products`);
  }
  console.log(`PCMAX catalog ready. Added ${added} products.`);
} catch (error) {
  console.error(`Product seeding failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
