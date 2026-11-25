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
import { registerUserRoutes } from './routes/user.routes.js';
import { registerAdminRoutes } from './routes/admin.routes.js';
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
  const clearUnknownLogin = (key) => unknownLoginAttempts.delete(key);
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
  registerUserRoutes(app, {
    authLimiter, sendLoginLock, recordUnknownLogin, clearUnknownLogin, invalidLogin, validate, fail,
    requireAuth, audit, accountInput, emailSchema, profileInput, checkoutInput,
    idSchema, Product, Category, User, Order, mongoose,
  });
  registerAdminRoutes(app, {
    validate, fail, requireAuth, requireAdmin, audit, productInput, categoryInput,
    idSchema, slug, randomBytes, z, Product, Category, User, Order, AuditLog,
  });
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
