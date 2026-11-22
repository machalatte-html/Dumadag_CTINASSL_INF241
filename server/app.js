import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import mongoose from 'mongoose';
import path from 'node:path';
import { Product, Category, User, Order, AuditLog } from './models.js';

const idSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const productInput = z
  .object({
    name: z.string().trim().min(2).max(140),
    category: z.string().regex(/^[a-f\d]{24}$/i),
    brand: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(3000),
    price: z.number().finite().nonnegative(),
    stock: z.number().int().nonnegative().max(100000),
    image: z.string().url().max(1000).or(z.literal('')).optional(),
    specs: z.record(z.string(), z.string().max(200)).optional(),
    featured: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .strict();
const categoryInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(400).optional(),
  })
  .strict();
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const genderSchema = z.enum(['female', 'male', 'nonbinary', 'prefer_not_to_say']);
const accountInput = z
  .object({
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    email: emailSchema,
    password: z.string().min(10).max(128),
    gender: genderSchema,
  })
  .strict();
const birthdaySchema = z.string().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10)
  );
}, 'Enter a valid birthday that is not in the future.');
const profileInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    birthday: birthdaySchema,
    gender: genderSchema,
    address: z.string().trim().max(500),
    currentPassword: z.string().max(128).optional(),
    newPassword: z.string().min(10).max(128).optional(),
  })
  .strict();
const checkoutInput = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().regex(/^[a-f\d]{24}$/i),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    paymentMethod: z.enum(['cod', 'manual']),
    shippingAddress: z.string().trim().min(8).max(500),
  })
  .strict();
const slug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", process.env.CLIENT_ORIGIN || 'http://localhost:5173'],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    }),
  );
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use(mongoSanitize());
  app.use(
    session({
      name: 'pcmax.sid',
      secret:
        process.env.SESSION_SECRET ||
        (process.env.NODE_ENV === 'test'
          ? 'test-session-secret-that-is-long-enough'
          : 'development-only-change-this-session-secret-32'),
      resave: false,
      saveUninitialized: false,
      store: process.env.MONGODB_URI
        ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, ttl: 60 * 60 * 24 * 7 })
        : undefined,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.COOKIE_SAME_SITE || 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  app.use('/api', limiter);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again later.' },
  });
  const unknownLoginAttempts = new Map();
  const sendLoginLock = (res, until) => {
    const retryAfterSeconds = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(423).json({
      error: 'Too many incorrect sign-in attempts.',
      retryAfterSeconds,
    });
  };
  const recordUnknownLogin = (key) => {
    const now = Date.now();
    if (unknownLoginAttempts.size > 10000) {
      for (const [entryKey, entry] of unknownLoginAttempts) {
        if (now - entry.updatedAt > 60_000 && (!entry.lockedUntil || entry.lockedUntil <= now))
          unknownLoginAttempts.delete(entryKey);
      }
    }
    let entry = unknownLoginAttempts.get(key);
    if (entry?.lockedUntil > now) return { lockedUntil: entry.lockedUntil };
    if (!entry || now - entry.updatedAt > 60_000 || entry.lockedUntil <= now)
      entry = { attempts: 0, updatedAt: now, lockedUntil: 0 };
    entry.attempts += 1;
    entry.updatedAt = now;
    if (entry.attempts >= 3) {
      entry.attempts = 0;
      entry.lockedUntil = now + 60_000;
    }
    unknownLoginAttempts.set(key, entry);
    return { attemptsRemaining: 3 - entry.attempts, lockedUntil: entry.lockedUntil };
  };
  const invalidLogin = (res, attemptsRemaining) =>
    res.status(401).json({ error: 'Email or password is incorrect', attemptsRemaining });
  const fail = (res, status, error) => res.status(status).json({ error });
  const validate = (schema, data, res) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid request data',
        fields: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'request',
          message: issue.message,
        })),
      });
      return null;
    }
    return result.data;
  };
  const requireAuth = (req, res, next) =>
    req.session.user ? next() : fail(res, 401, 'Sign in required');
  const requireAdmin = (req, res, next) =>
    req.session.user?.role === 'admin'
      ? next()
      : fail(res, req.session.user ? 403 : 401, 'Administrator access required');
  const csrf = (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (!req.session.user && !['/auth/login', '/auth/register'].includes(req.path)) return next();
    if (!req.session.csrf || req.get('X-CSRF-Token') !== req.session.csrf)
      return fail(res, 403, 'Invalid CSRF token');
    next();
  };
  app.use('/api', csrf);
  const audit = async (req, action, target, details = {}) => {
    try {
      await AuditLog.create({
        actor: req.session.user?._id,
        action,
        target: String(target || ''),
        details,
        ip: req.ip,
      });
    } catch {
      /* Audit storage failures never expose data to clients. */
    }
  };
  app.get('/api/health', (_req, res) =>
    res.json({
      status: 'ok',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable',
      brand: 'PCMAX',
    }),
  );
  app.get('/api/csrf', (req, res) => {
    if (!req.session.csrf) req.session.csrf = randomBytes(32).toString('hex');
    res.json({ token: req.session.csrf });
  });
  app.post('/api/auth/register', authLimiter, async (req, res, next) => {
    try {
      const input = validate(accountInput, req.body, res);
      if (!input) return;
      if (await User.exists({ email: input.email }))
        return fail(res, 409, 'An account with this email already exists');
      const name = `${input.firstName} ${input.lastName}`.trim();
      const user = await User.create({
        ...input,
        name,
        password: await bcrypt.hash(input.password, 12),
      });
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.user = {
          _id: user._id.toString(),
          name,
          email: user.email,
          role: 'customer',
        };
        req.session.csrf = randomBytes(32).toString('hex');
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          audit(req, 'customer.register', user._id);
          res.status(201).json({ user: req.session.user, csrfToken: req.session.csrf });
        });
      });
    } catch (e) {
      if (e.code === 11000) return fail(res, 409, 'An account with this email already exists');
      next(e);
    }
  });
  app.post('/api/auth/login', authLimiter, async (req, res, next) => {
    try {
      const input = validate(
        z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict(),
        req.body,
        res,
      );
      if (!input) return;
      const user = await User.findOne({ email: input.email }).select(
        '+password +loginFailedAttempts +loginLockedUntil',
      );
      const lockKey = `${req.ip}:${input.email}`;
      if (user?.loginLockedUntil && user.loginLockedUntil.getTime() > Date.now())
        return sendLoginLock(res, user.loginLockedUntil);

      const passwordMatches = user
        ? await bcrypt.compare(input.password, user.password)
        : await bcrypt.compare(
            input.password,
            '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
          );
      if (!passwordMatches) {
        if (!user) {
          const result = recordUnknownLogin(lockKey);
          if (result.lockedUntil) return sendLoginLock(res, new Date(result.lockedUntil));
          return invalidLogin(res, result.attemptsRemaining);
        }

        const attempt = await User.findOneAndUpdate(
          {
            _id: user._id,
            $or: [
              { loginLockedUntil: { $exists: false } },
              { loginLockedUntil: null },
              { loginLockedUntil: { $lte: new Date() } },
            ],
          },
          { $inc: { loginFailedAttempts: 1 } },
          { new: true },
        ).select('+loginFailedAttempts');

        if (!attempt) {
          const latest = await User.findById(user._id).select('+loginLockedUntil');
          return latest?.loginLockedUntil
            ? sendLoginLock(res, latest.loginLockedUntil)
            : invalidLogin(res, 1);
        }
        if (attempt.loginFailedAttempts >= 3) {
          const lockedUntil = new Date(Date.now() + 60_000);
          await User.updateOne(
            { _id: user._id },
            { $set: { loginFailedAttempts: 0, loginLockedUntil: lockedUntil } },
          );
          return sendLoginLock(res, lockedUntil);
        }
        return invalidLogin(res, 3 - attempt.loginFailedAttempts);
      }

      await User.updateOne(
        { _id: user._id },
        { $set: { loginFailedAttempts: 0 }, $unset: { loginLockedUntil: 1 } },
      );
      unknownLoginAttempts.delete(lockKey);
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.user = {
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
        req.session.csrf = randomBytes(32).toString('hex');
        req.session.save((saveErr) =>
          saveErr
            ? next(saveErr)
            : res.json({ user: req.session.user, csrfToken: req.session.csrf }),
        );
      });
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/auth/logout', requireAuth, (req, res, next) =>
    req.session.destroy((err) =>
      err
        ? next(err)
        : res
            .clearCookie('pcmax.sid', {
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
            .status(204)
            .end(),
    ),
  );
  app.get('/api/auth/me', (req, res) => res.json({ user: req.session.user || null }));
  app.get('/api/profile', requireAuth, async (req, res, next) => {
    try {
      const user = await User.findById(req.session.user._id)
        .select('name firstName lastName email birthday gender address role')
        .lean();
      if (!user) return fail(res, 404, 'Profile not found');
      res.json({
        profile: {
          ...user,
          firstName: user.firstName || user.name.split(/\s+/)[0] || '',
          lastName: user.lastName || user.name.split(/\s+/).slice(1).join(' '),
          birthday: user.birthday || '',
          gender: user.gender || 'prefer_not_to_say',
          address: user.address || '',
        },
      });
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/profile', requireAuth, async (req, res, next) => {
    try {
      const input = validate(profileInput, req.body, res);
      if (!input) return;
      const current = await User.findById(req.session.user._id).select('+password');
      if (!current) return fail(res, 404, 'Profile not found');

      const emailChanging = input.email !== current.email;
      const passwordChanging = Boolean(input.newPassword);
      if (emailChanging || passwordChanging) {
        if (!input.currentPassword)
          return fail(res, 400, 'Enter your current password to change your email or password.');
        if (!(await bcrypt.compare(input.currentPassword, current.password)))
          return fail(res, 401, 'Current password is incorrect.');
      }
      if (emailChanging && (await User.exists({ email: input.email, _id: { $ne: current._id } })))
        return fail(res, 409, 'An account with this email already exists.');

      const nameParts = input.name.split(/\s+/);
      const update = {
        name: input.name,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' '),
        email: input.email,
        birthday: input.birthday,
        gender: input.gender,
        address: input.address,
      };
      if (passwordChanging) update.password = await bcrypt.hash(input.newPassword, 12);

      const user = await User.findByIdAndUpdate(req.session.user._id, update, {
        new: true,
        runValidators: true,
        select: 'name firstName lastName email birthday gender role address',
      });
      if (!user) return fail(res, 404, 'Profile not found');
      req.session.user.name = user.name;
      req.session.user.email = user.email;
      const changedFields = ['name', 'email', 'birthday', 'gender', 'address'];
      if (passwordChanging) changedFields.push('password');
      await audit(req, 'profile.update', user._id, { changedFields });
      res.json({ profile: user, user: req.session.user });
    } catch (e) {
      if (e.code === 11000) return fail(res, 409, 'An account with this email already exists.');
      next(e);
    }
  });
  app.get('/api/products', async (req, res, next) => {
    try {
      const q = z
        .string()
        .trim()
        .max(100)
        .safeParse(req.query.q || '');
      if (!q.success) return fail(res, 400, 'Invalid search');
      const filter = { active: true };
      if (q.data) filter.$text = { $search: q.data };
      if (req.query.category && idSchema.safeParse(req.query.category).success)
        filter.category = req.query.category;
      if (req.query.brand) filter.brand = String(req.query.brand).slice(0, 80);
      if (req.query.minPrice || req.query.maxPrice) {
        filter.price = {};
        if (Number.isFinite(Number(req.query.minPrice)))
          filter.price.$gte = Math.max(0, Number(req.query.minPrice));
        if (Number.isFinite(Number(req.query.maxPrice)))
          filter.price.$lte = Math.max(0, Number(req.query.maxPrice));
      }
      const products = await Product.find(filter)
        .populate('category', 'name slug')
        .limit(100)
        .sort(
          req.query.sort === 'price-asc'
            ? { price: 1 }
            : req.query.sort === 'price-desc'
              ? { price: -1 }
              : { featured: -1, createdAt: -1 },
        )
        .lean();
      res.json({ products });
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/products/:id', async (req, res, next) => {
    try {
      const identifier = idSchema.safeParse(req.params.id);
      const productSlug = z
        .string()
        .regex(/^[a-z0-9-]{1,180}$/i)
        .safeParse(req.params.id);
      if (!identifier.success && !productSlug.success)
        return fail(res, 400, 'Invalid product identifier');
      const selector = identifier.success ? { _id: identifier.data } : { slug: productSlug.data };
      const product = await Product.findOne({ ...selector, active: true })
        .populate('category', 'name slug')
        .lean();
      return product ? res.json({ product }) : fail(res, 404, 'Product not found');
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/categories', async (_req, res, next) => {
    try {
      res.json({ categories: await Category.find().sort('name').lean() });
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/checkout', requireAuth, async (req, res, next) => {
    const input = validate(checkoutInput, req.body, res);
    if (!input) return;
    const session = await mongoose.startSession();
    try {
      let created;
      await session.withTransaction(async () => {
        const quantities = new Map();
        for (const item of input.items)
          quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
        if ([...quantities.values()].some((q) => q > 20))
          throw Object.assign(new Error('Invalid quantity'), { status: 400 });
        const products = await Product.find({
          _id: { $in: [...quantities.keys()] },
          active: true,
        }).session(session);
        if (products.length !== quantities.size)
          throw Object.assign(new Error('A product is unavailable'), { status: 409 });
        const items = [];
        let subtotal = 0;
        for (const product of products) {
          const quantity = quantities.get(product._id.toString());
          if (product.stock < quantity)
            throw Object.assign(new Error(`${product.name} does not have enough stock`), {
              status: 409,
            });
          const result = await Product.updateOne(
            { _id: product._id, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } },
            { session },
          );
          if (result.modifiedCount !== 1)
            throw Object.assign(new Error('Stock changed. Please review your cart.'), {
              status: 409,
            });
          subtotal += product.price * quantity;
          items.push({
            product: product._id,
            name: product.name,
            image: product.image,
            price: product.price,
            quantity,
          });
        }
        const shipping = subtotal >= 16000 ? 0 : 750;
        [created] = await Order.create(
          [
            {
              user: req.session.user._id,
              items,
              subtotal,
              shipping,
              total: subtotal + shipping,
              currency: 'PHP',
              paymentMethod: input.paymentMethod,
              shippingAddress: input.shippingAddress,
            },
          ],
          { session },
        );
      });
      await audit(req, 'order.create', created._id, {
        total: created.total,
        currency: created.currency,
      });
      res.status(201).json({ order: created });
    } catch (e) {
      fail(res, e.status || 500, e.status ? e.message : 'Unable to place your order');
    } finally {
      await session.endSession();
    }
  });
  app.get('/api/orders/mine', requireAuth, async (req, res, next) => {
    try {
      res.json({
        orders: await Order.find({ user: req.session.user._id }).sort({ createdAt: -1 }).lean(),
      });
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const [products, orders, customers, revenue] = await Promise.all([
        Product.countDocuments(),
        Order.countDocuments(),
        User.countDocuments({ role: 'customer' }),
        Order.aggregate([
          { $match: { status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]),
      ]);
      res.json({ overview: { products, orders, customers, revenue: revenue[0]?.total || 0 } });
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/admin/products', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json({
        products: await Product.find().populate('category', 'name').sort({ createdAt: -1 }).lean(),
      });
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/admin/products', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const input = validate(productInput, req.body, res);
      if (!input) return;
      const product = await Product.create({
        ...input,
        slug: `${slug(input.name)}-${randomBytes(3).toString('hex')}`,
      });
      await audit(req, 'product.create', product._id);
      res.status(201).json({ product });
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const parsed = validate(productInput.partial(), req.body, res);
      if (!parsed) return;
      if (!idSchema.safeParse(req.params.id).success)
        return fail(res, 400, 'Invalid product identifier');
      const product = await Product.findByIdAndUpdate(req.params.id, parsed, {
        new: true,
        runValidators: true,
      });
      if (!product) return fail(res, 404, 'Product not found');
      await audit(req, 'product.update', product._id);
      res.json({ product });
    } catch (e) {
      next(e);
    }
  });
  app.delete('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!idSchema.safeParse(req.params.id).success)
        return fail(res, 400, 'Invalid product identifier');
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { active: false },
        { new: true },
      );
      if (!product) return fail(res, 404, 'Product not found');
      await audit(req, 'product.archive', product._id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/admin/categories', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const input = validate(categoryInput, req.body, res);
      if (!input) return;
      const category = await Category.create({ ...input, slug: slug(input.name) });
      await audit(req, 'category.create', category._id);
      res.status(201).json({ category });
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/admin/categories/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!idSchema.safeParse(req.params.id).success)
        return fail(res, 400, 'Invalid category identifier');
      const input = validate(categoryInput, req.body, res);
      if (!input) return;
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        { ...input, slug: slug(input.name) },
        { new: true, runValidators: true },
      );
      if (!category) return fail(res, 404, 'Category not found');
      await audit(req, 'category.update', category._id);
      res.json({ category });
    } catch (e) {
      next(e);
    }
  });
  app.delete('/api/admin/categories/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!idSchema.safeParse(req.params.id).success)
        return fail(res, 400, 'Invalid category identifier');
      if (await Product.exists({ category: req.params.id, active: true }))
        return fail(res, 409, 'Archive or reassign active products before deleting this category');
      const category = await Category.findByIdAndDelete(req.params.id);
      if (!category) return fail(res, 404, 'Category not found');
      await audit(req, 'category.delete', category._id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/admin/customers', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json({
        customers: await User.find({ role: 'customer' })
          .select('name email phone address createdAt')
          .sort({ createdAt: -1 })
          .limit(500)
          .lean(),
      });
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/admin/orders', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json({
        orders: await Order.find()
          .populate('user', 'name email')
          .sort({ createdAt: -1 })
          .limit(500)
          .lean(),
      });
    } catch (e) {
      next(e);
    }
  });
  app.patch('/api/admin/orders/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!idSchema.safeParse(req.params.id).success)
        return fail(res, 400, 'Invalid order identifier');
      const input = validate(
        z
          .object({
            status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']).optional(),
            paymentStatus: z.enum(['pending', 'confirmed']).optional(),
          })
          .strict()
          .refine((v) => Object.keys(v).length > 0),
        req.body,
        res,
      );
      if (!input) return;
      const order = await Order.findByIdAndUpdate(req.params.id, input, {
        new: true,
        runValidators: true,
      });
      if (!order) return fail(res, 404, 'Order not found');
      await audit(req, 'order.update', order._id, input);
      res.json({ order });
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/admin/audit', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json({
        logs: await AuditLog.find()
          .populate('actor', 'name email')
          .sort({ createdAt: -1 })
          .limit(300)
          .lean(),
      });
    } catch (e) {
      next(e);
    }
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) =>
      cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  });
  app.post(
    '/api/admin/upload-check',
    requireAuth,
    requireAdmin,
    upload.single('image'),
    (req, res) =>
      req.file
        ? res.status(501).json({
            error: 'Image storage is not configured. Use a trusted object storage provider.',
          })
        : fail(res, 400, 'A JPEG, PNG, or WebP image is required'),
  );
  if (process.env.NODE_ENV === 'production') {
    const clientDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(clientDir, { index: false, dotfiles: 'deny' }));
    app.get('*', (req, res, next) =>
      req.path.startsWith('/api/')
        ? next()
        : res.sendFile(path.join(clientDir, 'index.html'), (err) => err && next(err)),
    );
  }
  app.use((req, res) => fail(res, 404, 'Not found'));
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) return fail(res, 400, 'Invalid upload');
    if (err?.name === 'ValidationError' || err?.code === 11000)
      return fail(res, 400, 'Invalid or duplicate data');
    console.error('Request failed:', err?.message);
    return fail(res, 500, 'Internal server error');
  });
  return app;
}
