import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, unique: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, required: true, trim: true },
    description: { type: String, required: true, maxlength: 3000 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['PHP', 'USD'], default: 'PHP' },
    stock: { type: Number, required: true, min: 0, default: 0 },
    image: { type: String, default: '' },
    specs: { type: Map, of: String, default: {} },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
productSchema.index({ name: 'text', brand: 'text', description: 'text' });
const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, maxlength: 400, default: '' },
  },
  { timestamps: true },
);
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 101 },
    firstName: { type: String, trim: true, maxlength: 50, default: '' },
    lastName: { type: String, trim: true, maxlength: 50, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    loginFailedAttempts: { type: Number, default: 0, select: false },
    loginLockedUntil: { type: Date, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    birthday: { type: String, default: '' },
    gender: {
      type: String,
      enum: ['female', 'male', 'nonbinary', 'prefer_not_to_say'],
      default: 'prefer_not_to_say',
    },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  { timestamps: true },
);
const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        image: String,
        price: Number,
        quantity: Number,
      },
    ],
    subtotal: Number,
    shipping: Number,
    total: Number,
    currency: { type: String, enum: ['PHP', 'USD'], default: 'PHP' },
    paymentMethod: { type: String, enum: ['cod', 'manual'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'confirmed'], default: 'pending' },
    status: {
      type: String,
      enum: ['processing', 'shipped', 'delivered', 'cancelled'],
      default: 'processing',
    },
    shippingAddress: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true },
);
const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    target: String,
    details: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true },
);
export const Product = mongoose.models.Product || model('Product', productSchema);
export const Category = mongoose.models.Category || model('Category', categorySchema);
export const User = mongoose.models.User || model('User', userSchema);
export const Order = mongoose.models.Order || model('Order', orderSchema);
export const AuditLog = mongoose.models.AuditLog || model('AuditLog', auditSchema);
