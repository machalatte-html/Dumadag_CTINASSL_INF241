import 'dotenv/config';
import mongoose from 'mongoose';
import { Product, Category, User, Order, AuditLog } from './models.js';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not configured.');
  process.exit(1);
}

const starterCategories = [
  ['Graphics Cards', 'Graphics cards for gaming and creative work.'],
  ['Processors', 'Desktop processors for a range of PC builds.'],
  ['Memory', 'System memory kits and upgrades.'],
  ['Storage', 'Solid state drives and other PC storage.'],
  ['Motherboards', 'Boards and platforms for PC builds.'],
  ['Power Supplies', 'Power supplies and cables for PC systems.'],
  ['Cases', 'Cases and enclosures for PC builds.'],
];

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await Promise.all(
    [Product, Category, User, Order, AuditLog].map((model) => model.createIndexes()),
  );
  for (const [name, description] of starterCategories) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    await Category.updateOne(
      { name },
      { $setOnInsert: { name, slug, description } },
      { upsert: true },
    );
  }
  console.log(
    `PCMAX database initialized. ${starterCategories.length} starter categories are ready.`,
  );
} catch (error) {
  console.error(`Database initialization failed: ${error.name}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
