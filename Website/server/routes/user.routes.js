import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

export function registerUserRoutes(app, {
  authLimiter, sendLoginLock, recordUnknownLogin, clearUnknownLogin, invalidLogin, validate, fail,
  requireAuth, audit, accountInput, emailSchema, profileInput, checkoutInput,
  idSchema, Product, Category, User, Order, mongoose,
}) {
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
      clearUnknownLogin(lockKey);
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
}
