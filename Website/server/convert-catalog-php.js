import 'dotenv/config';
import mongoose from 'mongoose';
import { Product } from './models.js';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not configured.');
  process.exit(1);
}

const USD_PHP_RATE = 63.825;
const toPesos = (usd) => Math.round((usd * USD_PHP_RATE) / 50) * 50;

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const legacyProducts = await Product.find({
    $or: [{ currency: { $exists: false } }, { currency: 'USD' }],
  })
    .select('_id price')
    .lean();
  if (!legacyProducts.length) {
    console.log('No USD or unmarked catalog prices remain to convert.');
  } else {
    const result = await Product.bulkWrite(
      legacyProducts.map((product) => ({
        updateOne: {
          filter: {
            _id: product._id,
            $or: [{ currency: { $exists: false } }, { currency: 'USD' }],
          },
          update: { $set: { price: toPesos(product.price), currency: 'PHP' } },
        },
      })),
    );
    console.log(
      `Converted ${result.modifiedCount} product prices to PHP at PHP ${USD_PHP_RATE} per USD, rounded to the nearest PHP 50.`,
    );
  }
} catch (error) {
  console.error(`Catalog conversion failed: ${error.name}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
