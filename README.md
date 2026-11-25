# ARAN � Premium Food Ordering Platform

MERN modular monolith: `backend/` (Express + Mongoose, `/api/v1`, Swagger at `/api/docs`) and `frontend/` (React + Vite + Tailwind + PWA). The storefront lives at `/`, the admin console at `/admin`.

## Run locally
```bash
cd backend && npm i && cp .env.example .env && npm run dev     # :5000 (in-memory MongoDB + demo menu if MONGODB_URI is empty)
cd frontend && npm i && npm run dev                              # :5173 (proxies /api and /socket.io)
```
Customers/riders sign in with a mobile OTP (in dev the code is shown on screen because no SMS provider is configured). Dev owner login (non-production only): `owner@aran.local` / `Aran@12345` at `/admin/login`.
In production set `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` once, then remove the password.

## Tests
`cd backend && npm test` (Vitest + Supertest, in-memory MongoDB) � `cd frontend && npm test` (Vitest + RTL) � `npm run test:e2e` (Playwright; starts both servers; `npx playwright install chromium` first).

## Credentials you must supply (nothing is faked when absent)
| Feature | Env vars | Without them |
|---|---|---|
| Online payments | `RAZORPAY_KEY_ID/SECRET`, `RAZORPAY_WEBHOOK_SECRET` (webhook URL: `/api/v1/webhooks/razorpay`; events payment.captured, payment.failed, refund.*) | Online payment returns 503; COD still works |
| Image upload | `CLOUDINARY_*` | Upload returns 503; products show a branded placeholder |
| Email | `SMTP_*` | Skipped |
| Web push | `VAPID_*` (`npx web-push generate-vapid-keys`) | Skipped |
| WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | Skipped |

## Key design decisions
- Money is integer paise; prices, coupons, tax, delivery fee and stock are always recomputed server-side (`pricing.service.js`).
- Stock (for products with "Track stock"): reserved at order creation (atomic conditional update ? no overselling), released on cancel / 15-min payment timeout, deducted on delivered/picked-up.
- Orders: backend state machine; idempotency key prevents duplicate orders; payment capture is idempotent across client verify + webhook; late payments on expired orders are auto-refunded.
- Auth: bcrypt, 15-min access JWT in memory, rotating httpOnly refresh cookie with reuse detection, CSRF header on cookie endpoints.
- Guest orders are tracked with an unguessable token stored on the device. Phone OTP verification needs an SMS provider and is not implemented.
- Live GPS tracking is intentionally absent (no real location source yet).

## Deploy
Frontend ? Vercel (`frontend/vercel.json`), API ? Render (`render.yaml`), DB ? MongoDB Atlas. Set `VITE_API_URL` for the frontend build if the API is on another origin and add that origin to `CLIENT_ORIGINS`.

## Managing the business from the admin panel (no code changes)
- **Products / categories:** add, edit, change price, availability, photos, allergens, customisations, stock; "remove" archives a product (history is kept, restorable). The storefront always reads live data.
- **Homepage hero:** Admin → Homepage hero. Add, replace, reorder, hide or delete the items that change as visitors scroll the top of the homepage; optionally link each to a menu item (shows its live price). Needs Cloudinary for uploads; the four starter items ship with the frontend.
- **Brand name, contact, timings, delivery, pickup, tax:** Admin → Settings.
- **Payment gateway (owner only):** Admin → Settings → Payment gateway. Enter Razorpay Key ID, Key Secret and Webhook secret, toggle online / cash-on-delivery, and press *Test connection*. Secrets are AES-256-GCM encrypted in MongoDB, write-only (never shown again) and changes are audit-logged. Online payment stays hidden at checkout until valid keys are saved.

> **Full list of required accounts, licences (FSSAI, GST, DLT for SMS), env vars and the go-live runbook: see [DEPLOYMENT.md](DEPLOYMENT.md).**

## Production deploy checklist
1. **MongoDB Atlas** cluster → `MONGODB_URI`.
2. **API (Render/Railway):** set `NODE_ENV=production`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SETTINGS_ENCRYPTION_KEY` (long random strings, never change the encryption key afterwards), `CLIENT_ORIGINS` and `CLIENT_URL` (your storefront URL), `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` (first boot creates the owner; then remove the password var). Add `SEED_DEMO=1` only if you want the sample menu.
3. **Frontend (Vercel):** root `frontend`, build `npm run build`, env `VITE_API_URL=https://api.yourdomain` (or proxy `/api` + `/socket.io` to the API on the same domain).
4. Sign in at `/admin/login`, change the owner password, fill Settings, add categories/products, upload photos (needs `CLOUDINARY_*` on the API).
5. Payment gateway panel → keys → Test connection. In Razorpay add the webhook URL shown there with the same secret.
6. Optional: `SMTP_*`, `VAPID_*`, `WHATSAPP_*`. Serve everything over HTTPS (cookies are `Secure` in production).
7. Back up Atlas, add uptime/error monitoring, run `npm test` (backend/frontend) and `npm run test:e2e` before each release.