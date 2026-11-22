import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

vi.mock('./models.js', () => ({
  Product: {
    find: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    countDocuments: vi.fn(),
  },
  Category: { find: vi.fn(), create: vi.fn() },
  User: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findById: vi.fn(),
    updateOne: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  Order: {
    find: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    aggregate: vi.fn(),
  },
  AuditLog: { create: vi.fn(), find: vi.fn() },
}));
vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual.default, connection: { readyState: 0 }, startSession: vi.fn() },
  };
});

import { createApp } from './app.js';
import { User, Product, Order, AuditLog } from './models.js';
import mongoose from 'mongoose';

let app;
beforeEach(() => {
  vi.clearAllMocks();
  app = createApp();
});

describe('PCMAX API security and core flows', () => {
  it('reports the PCMAX service and does not expose environment values', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'ok', database: 'unavailable', brand: 'PCMAX' });
    expect(JSON.stringify(r.body)).not.toContain('SESSION_SECRET');
  });
  it('blocks unauthenticated access to admin and checkout routes', async () => {
    expect((await request(app).get('/api/admin/overview')).status).toBe(401);
    expect((await request(app).post('/api/checkout').send({})).status).toBe(401);
  });
  it('rejects NoSQL operator payloads and unknown registration fields', async () => {
    const agent = request.agent(app);
    const token = (await agent.get('/api/csrf')).body.token;
    const r = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ email: { $ne: null }, password: 'anything' });
    expect(r.status).toBe(400);
    const signup = await agent.post('/api/auth/register').set('X-CSRF-Token', token).send({
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.com',
      password: 'correct-horse-battery',
      gender: 'prefer_not_to_say',
      role: 'admin',
    });
    expect(signup.status).toBe(400);
    expect(User.create).not.toHaveBeenCalled();
  });
  it('returns generic errors for unknown login credentials', async () => {
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    const agent = request.agent(app);
    const token = (await agent.get('/api/csrf')).body.token;
    const r = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ email: 'missing@example.com', password: 'guess' });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Email or password is incorrect');
    expect(r.body.error).not.toContain('missing@example.com');
    expect(r.body.attemptsRemaining).toBe(2);
  });
  it('locks sign-in for one minute after three incorrect passwords', async () => {
    const id = '650000000000000000000008';
    const passwordHash = await bcrypt.hash('correct-horse-battery', 4);
    const account = {
      _id: { toString: () => id },
      name: 'Taylor Builder',
      email: 'taylor@example.com',
      role: 'customer',
      password: passwordHash,
      loginFailedAttempts: 0,
      loginLockedUntil: undefined,
    };
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(account) });
    User.findOneAndUpdate.mockImplementation((_filter, update) => {
      account.loginFailedAttempts += update.$inc.loginFailedAttempts;
      return { select: vi.fn().mockResolvedValue(account) };
    });
    User.updateOne.mockImplementation(async (_filter, update) => {
      Object.assign(account, update.$set);
      return { modifiedCount: 1 };
    });

    const agent = request.agent(app);
    const token = (await agent.get('/api/csrf')).body.token;
    const wrongPassword = () =>
      agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', token)
        .send({ email: account.email, password: 'incorrect-password' });

    const first = await wrongPassword();
    const second = await wrongPassword();
    const third = await wrongPassword();
    expect(first.status).toBe(401);
    expect(first.body.attemptsRemaining).toBe(2);
    expect(second.status).toBe(401);
    expect(second.body.attemptsRemaining).toBe(1);
    expect(third.status).toBe(423);
    expect(third.body.retryAfterSeconds).toBe(60);

    const blocked = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ email: account.email, password: 'correct-horse-battery' });
    expect(blocked.status).toBe(423);
    expect(User.findOneAndUpdate).toHaveBeenCalledTimes(3);
  });
  it('allows a user to sign in again after logout with a refreshed CSRF token', async () => {
    const id = '650000000000000000000004';
    const password = 'correct-horse-battery';
    const agent = request.agent(app);
    const initialToken = (await agent.get('/api/csrf')).body.token;
    User.exists.mockResolvedValue(false);
    User.create.mockResolvedValue({
      _id: { toString: () => id },
      name: 'Taylor Builder',
      email: 'taylor@example.com',
    });
    AuditLog.create.mockResolvedValue({});

    const signup = await agent.post('/api/auth/register').set('X-CSRF-Token', initialToken).send({
      firstName: 'Taylor',
      lastName: 'Builder',
      email: 'taylor@example.com',
      password,
      gender: 'prefer_not_to_say',
    });
    expect(signup.status).toBe(201);

    const logout = await agent.post('/api/auth/logout').set('X-CSRF-Token', signup.body.csrfToken);
    expect(logout.status).toBe(204);

    const staleAttempt = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', signup.body.csrfToken)
      .send({ email: 'taylor@example.com', password });
    expect(staleAttempt.status).toBe(403);

    const freshToken = (await agent.get('/api/csrf')).body.token;
    expect(freshToken).not.toBe(signup.body.csrfToken);
    User.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: { toString: () => id },
        name: 'Taylor Builder',
        email: 'taylor@example.com',
        role: 'customer',
        password: await bcrypt.hash(password, 4),
      }),
    });

    const login = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', freshToken)
      .send({ email: 'taylor@example.com', password });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe('taylor@example.com');
    expect(login.body.csrfToken).toBeTruthy();
  });
  it('validates product identifiers before database access', async () => {
    const r = await request(app).get('/api/products/not_an_object_id');
    expect(r.status).toBe(400);
    expect(User.findOne).not.toHaveBeenCalled();
  });
  it('accepts the product form fields for an authenticated administrator', async () => {
    const adminId = '650000000000000000000005';
    const categoryId = '650000000000000000000006';
    const productId = '650000000000000000000007';
    const password = 'correct-horse-battery';
    User.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: { toString: () => adminId },
        name: 'Store Admin',
        email: 'admin@example.com',
        role: 'admin',
        password: await bcrypt.hash(password, 4),
      }),
    });
    const agent = request.agent(app);
    const token = (await agent.get('/api/csrf')).body.token;
    const login = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ email: 'admin@example.com', password });
    expect(login.status).toBe(200);

    Product.create.mockImplementation(async (product) => ({ _id: productId, ...product }));
    AuditLog.create.mockResolvedValue({});
    const payload = {
      name: 'Example 850W Power Supply',
      category: categoryId,
      brand: 'PCMAX',
      description: 'An 850W modular power supply for desktop computers.',
      price: 9500,
      stock: 5,
      image: '',
    };
    const response = await agent
      .post('/api/admin/products')
      .set('X-CSRF-Token', login.body.csrfToken)
      .send(payload);

    expect(response.status).toBe(201);
    expect(Product.create).toHaveBeenCalledWith(expect.objectContaining(payload));
  });
  it('returns a generic response for unknown API paths', async () => {
    const r = await request(app).get('/api/not-a-route');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('Not found');
  });
  it('creates a customer session without allowing a self-selected administrator role', async () => {
    const id = '650000000000000000000001';
    const agent = request.agent(app);
    const token = (await agent.get('/api/csrf')).body.token;
    User.exists.mockResolvedValue(false);
    User.create.mockResolvedValue({
      _id: { toString: () => id },
      name: 'Alex Builder',
      email: 'alex@example.com',
    });
    AuditLog.create.mockResolvedValue({});
    const r = await agent.post('/api/auth/register').set('X-CSRF-Token', token).send({
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.com',
      password: 'correct-horse-battery',
      gender: 'prefer_not_to_say',
      role: 'admin',
    });
    expect(r.status).toBe(400);
    const good = await agent.post('/api/auth/register').set('X-CSRF-Token', token).send({
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.com',
      password: 'correct-horse-battery',
      gender: 'prefer_not_to_say',
    });
    expect(good.status).toBe(201);
    expect(good.body.user.role).toBe('customer');
    expect(good.body.csrfToken).toBeTruthy();
    expect(User.create.mock.calls[0][0].password).not.toBe('correct-horse-battery');
    expect((await agent.get('/api/admin/overview')).status).toBe(403);
  });
  it('saves profile details and verifies the current password for email or password changes', async () => {
    const id = '650000000000000000000009';
    const currentPassword = 'old-correct-password';
    const newPassword = 'new-correct-password';
    const account = {
      _id: { toString: () => id },
      name: 'Morgan Builder',
      firstName: 'Morgan',
      lastName: 'Builder',
      email: 'morgan@example.com',
      gender: 'prefer_not_to_say',
      birthday: '',
      address: '',
      role: 'customer',
      password: await bcrypt.hash(currentPassword, 4),
    };
    User.exists.mockResolvedValue(false);
    User.create.mockResolvedValue({ ...account, _id: { toString: () => id } });
    User.findById.mockImplementation(() => ({
      select: vi.fn((fields) =>
        fields === '+password'
          ? Promise.resolve(account)
          : { lean: vi.fn().mockResolvedValue(account) },
      ),
    }));
    User.findByIdAndUpdate.mockImplementation(async (_userId, update) => {
      Object.assign(account, update);
      return { ...account, password: undefined };
    });
    AuditLog.create.mockResolvedValue({});

    const agent = request.agent(app);
    const csrfToken = (await agent.get('/api/csrf')).body.token;
    const signup = await agent.post('/api/auth/register').set('X-CSRF-Token', csrfToken).send({
      firstName: 'Morgan',
      lastName: 'Builder',
      email: 'morgan@example.com',
      password: currentPassword,
      gender: 'prefer_not_to_say',
    });
    expect(signup.status).toBe(201);

    const profileChanges = {
      name: 'Morgan A. Builder',
      email: 'morgan.new@example.com',
      birthday: '1995-06-12',
      gender: 'female',
      address: '12 Builder Street',
    };
    const rejected = await agent
      .put('/api/profile')
      .set('X-CSRF-Token', signup.body.csrfToken)
      .send({ ...profileChanges, currentPassword: 'incorrect-current-password' });
    expect(rejected.status).toBe(401);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();

    const saved = await agent
      .put('/api/profile')
      .set('X-CSRF-Token', signup.body.csrfToken)
      .send({
        ...profileChanges,
        currentPassword,
        newPassword,
      });

    expect(saved.status).toBe(200);
    expect(saved.body.profile.email).toBe('morgan.new@example.com');
    expect(saved.body.profile.name).toBe('Morgan A. Builder');
    expect(saved.body.profile.birthday).toBe('1995-06-12');
    expect(saved.body.profile.gender).toBe('female');
    const update = User.findByIdAndUpdate.mock.calls[0][1];
    expect(update.password).not.toBe(newPassword);
    expect(await bcrypt.compare(newPassword, update.password)).toBe(true);
    expect(saved.body.profile.password).toBeUndefined();
    const profile = await agent.get('/api/profile');
    expect(profile.status).toBe(200);
    expect(profile.body.profile.email).toBe('morgan.new@example.com');
    expect(profile.body.profile.firstName).toBe('Morgan');
    expect(profile.body.profile.lastName).toBe('A. Builder');
  });
  it('creates orders from server prices and conditionally deducts available stock', async () => {
    const id = '650000000000000000000002';
    const agent = request.agent(app);
    const token = (await agent.get('/api/csrf')).body.token;
    User.exists.mockResolvedValue(false);
    User.create.mockResolvedValue({
      _id: { toString: () => id },
      name: 'Alex Builder',
      email: 'alex@example.com',
    });
    AuditLog.create.mockResolvedValue({});
    const signup = await agent.post('/api/auth/register').set('X-CSRF-Token', token).send({
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.com',
      password: 'correct-horse-battery',
      gender: 'prefer_not_to_say',
    });
    const session = { withTransaction: async (fn) => fn(), endSession: vi.fn() };
    mongoose.startSession.mockResolvedValue(session);
    const product = {
      _id: { toString: () => '650000000000000000000003' },
      name: 'CPU',
      image: '',
      price: 100,
      stock: 2,
    };
    Product.find.mockReturnValue({ session: vi.fn().mockResolvedValue([product]) });
    Product.updateOne.mockResolvedValue({ modifiedCount: 1 });
    Order.create.mockResolvedValue([{ _id: 'order-1', total: 850, currency: 'PHP' }]);
    const r = await agent
      .post('/api/checkout')
      .set('X-CSRF-Token', signup.body.csrfToken)
      .send({
        items: [{ productId: product._id.toString(), quantity: 1 }],
        paymentMethod: 'cod',
        shippingAddress: '12 Builder Street, Taipei',
      });
    expect(r.status).toBe(201);
    expect(r.body.order.total).toBe(850);
    expect(Product.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      { $inc: { stock: -1 } },
      { session },
    );
    expect(Order.create.mock.calls[0][0][0]).toMatchObject({
      subtotal: 100,
      shipping: 750,
      total: 850,
      currency: 'PHP',
      paymentMethod: 'cod',
    });
  });
});
