# PCMAX

PCMAX is a light themed PC components storefront built with React, Vite, Express, MongoDB, and Mongoose. It includes catalog browsing and search, cart and checkout, customer accounts and order history, and a role-protected store dashboard.

## Requirements

- Node.js 20 or newer and npm
- A MongoDB Atlas cluster (MongoDB 6+ recommended)
- A database user with access to the PCMAX database and an Atlas network access rule for your development or deployment host

## Local setup

1. Copy `.env.example` to `.env`.
2. Replace `MONGODB_URI` with the connection string from Atlas and URL-encode special characters in the database username or password. Replace `SESSION_SECRET` with at least 32 random characters. Never commit `.env`.
3. Set `CLIENT_ORIGIN=http://localhost:5173`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for your initial administrator setup. The application does not silently create an admin account; see **Create the first administrator** below.
4. Install dependencies and start both development servers:

   ```sh
   npm install
   npm run dev
   ```

   The Vite storefront runs at `http://localhost:5173`; Express listens at port 4000. Vite proxies `/api` requests to Express.

5. Initialize schema indexes and starter product categories:

   ```sh
   npm run db:init
   ```

   Product categories are MongoDB references; product create/update requests require a valid category ObjectId.

6. Add a starter catalog with at least three products in each category:

   ```sh
   npm run db:seed-products
   ```

   This adds missing listings without deleting existing products. The starter prices and stock counts are illustrative; review them in the admin dashboard before accepting customer orders.

The catalog is displayed in Philippine pesos. Starter USD-derived catalog values were converted at the BSP reference rate of PHP 63.825 per USD on 18 November 2026 and rounded to the nearest PHP 50. Future admin-entered prices are interpreted as PHP. The peso conversion is a one-time catalog migration, not a live currency feed. To convert legacy unmarked or USD product prices, run `npm run db:convert-php`; it skips products already marked PHP.

For production, set `NODE_ENV=production`, a long unique `SESSION_SECRET`, the exact HTTPS storefront origin, `COOKIE_SAME_SITE=lax` (or `strict` when practical), and the Atlas URI. Serve the client over HTTPS. Production cookies are Secure and HttpOnly. If your frontend and API are on different sites, configure SameSite and CSRF behavior deliberately rather than broadly allowing origins.

### Deploying to Vercel

The Vite storefront and Express API deploy from the same project. `vercel.json` routes `/api/*` to the Vercel Function in `api/handler.js`, which opens the MongoDB connection and forwards requests to the existing Express API. Add `MONGODB_URI`, `SESSION_SECRET` (at least 32 random characters), and `CLIENT_ORIGIN` (the exact site origin, such as `https://your-project.vercel.app`) under Vercel Project Settings → Environment Variables, then redeploy. Do not upload `.env` to GitHub. Use the production domain for public access; preview deployment URLs may require Vercel authentication depending on Deployment Protection settings.

## Create the first administrator

Registration only creates customer accounts; it cannot set roles. After registering the intended admin account, use a trusted Atlas administrative interface to set that account's `role` field to `admin`. Keep database owner credentials separate from the application database user. The `.env.example` admin variables are placeholders and are not used to auto-promote an account.

## Available commands

```sh
npm run dev       # Vite + Express with reload
npm run build     # production frontend bundle
npm start         # Express API
npm test          # API security and route tests
npm run check     # build and tests
npm run db:init   # indexes and starter categories
npm run db:seed-products # at least three products per category
npm run db:convert-php # one-time conversion of legacy USD/unmarked catalog prices
```

## Features and API

- Customer registration with separate first and last names, email, password, and gender; profile editing for full name, email, birthday, gender, address, and password; catalog search and category/price filters; cart, checkout, and order history.
- Product detail pages have shareable `/products/:slug` URLs. Email and password changes in the profile require the current password, and profile edits are saved to MongoDB with an on-screen confirmation.
- COD and manual payment confirmation statuses; there is no payment processor and the app does not request or store card credentials.
- Admin dashboard for overview, product create/archive, order status and manual payment updates, customer listing, and audit log browsing. Product edits are supported through the admin API.
- Express API routes are under `/api`. Session cookies are HttpOnly, SameSite, and Secure in production; sessions are persisted in MongoDB when `MONGODB_URI` is configured.
- Zod request schemas reject unrecognized keys, bounded JSON and upload sizes, Mongo operator sanitization, Helmet headers, restrictive credentialed CORS, rate limits, session-bound CSRF token checks for authenticated writes, bcrypt password hashes, and role checks are applied server-side.
- Checkout re-reads product prices and stock on the server and uses a MongoDB transaction to deduct stock and create the order. MongoDB transactions require Atlas or another replica-set deployment.

## Security notes and limitations

OWASP Top 10, ASVS, and WSTG informed the controls and test cases. This is not a penetration test, and no independent security assessment has been performed. The automated tests exercise representative auth, role-gating, validation, NoSQL injection, and error handling paths; they are not exhaustive security evidence.

- Product image uploads are intentionally not stored. The upload-check endpoint enforces size and image MIME allowlists but responds that trusted object storage must be configured; use a managed storage provider with content inspection before enabling uploads.
- The initial dashboard supports adding and archiving products, adding and deleting categories, and managing order and payment statuses. Product and category edit operations are available through protected API routes but do not yet have dashboard forms; customer records are currently read-only in the dashboard.
- Use a strong production session secret and Mongo-backed session storage. The development session fallback is in-memory when no Atlas URI exists.
- Atlas credentials, network access policy, TLS termination, backups, alerting, account recovery, email verification, and deployment-specific CSP/CORS values must be configured by the operator.
- User-submitted rich HTML is not rendered. Product images currently accept URLs; deploy with a restrictive trusted image source policy and validate any externally supplied URLs as part of product moderation.
- Manual payment confirmation is an operator-updated status only; payment instructions and reconciliation are handled outside this app.

## Project layout

```text
src/          React storefront, styling, and UI test setup
server/       Express app, Mongoose models, and API security tests
index.html    PCMAX document metadata and entry point
```
