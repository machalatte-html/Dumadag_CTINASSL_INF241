import multer from 'multer';

export function registerAdminRoutes(app, {
  validate, fail, requireAuth, requireAdmin, audit, productInput, categoryInput,
  idSchema, slug, randomBytes, z, Product, Category, User, Order, AuditLog,
}) {
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
}
