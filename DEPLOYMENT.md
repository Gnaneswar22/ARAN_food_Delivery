# ARAN.co – What you need to run this as a real delivery business

This is the complete checklist of accounts, services, licences and settings required to take ARAN.co live, with what each one is for and where it plugs in. Items marked **Required** block launch.

## 0. The links and credentials YOU must provide (copy this into your hosting dashboards)

| What | Format / example | Where to get it | Where it goes |
|---|---|---|---|
| **Database link** | `mongodb+srv://<dbUser>:<password>@<cluster>.<id>.mongodb.net/aran?retryWrites=true&w=majority` | MongoDB Atlas → Database → *Connect* → *Drivers*. Create a DB user, allow your API host's IP under *Network Access*, URL-encode special characters in the password (`@` → `%40`) | API env `MONGODB_URI` |
| **Storefront URL** | `https://aran.co` | your domain | API env `CLIENT_URL`, `CLIENT_ORIGINS` (comma-separated, e.g. `https://aran.co,https://admin.aran.co`) |
| **Separate Admin URL (optional)** | `https://admin.aran.co` | separate Vercel project (same `frontend/` folder) | Frontend env `VITE_APP_MODE=admin` on admin site, `VITE_APP_MODE=store` on main site; add admin URL to API `CLIENT_ORIGINS` |
| **API URL** | `https://api.aran.co` | your API host's custom domain | Frontend build env `VITE_API_URL` (omit if you proxy `/api` and `/socket.io` on the same domain) |
| **Webhook URL (give to Razorpay)** | `https://api.aran.co/api/v1/webhooks/razorpay` | shown in Admin → Payment gateway | Razorpay Dashboard → Webhooks (with your own secret) |
| **Razorpay** | Key ID `rzp_live_…`, Key Secret, Webhook secret | Razorpay Dashboard (after KYC) | Admin → Settings → Payment gateway |
| **SMS (OTP)** | MSG91 *Auth key* + DLT *Template ID* (or Twilio SID / token / from) | MSG91 dashboard + DLT portal | Admin → Settings → SMS & OTP login |
| **Cloudinary** | cloud name, API key, API secret | Cloudinary dashboard | API env `CLOUDINARY_*` |
| **Secrets you generate** | 3 long random strings | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | API env `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SETTINGS_ENCRYPTION_KEY` |
| **Owner account** | email + strong password | you choose | API env `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` (first boot only) |
| **Email (optional)** | SMTP host/port/user/pass | Resend / SES / Zoho | API env `SMTP_*` |
| **Address search (optional upgrade)** | Google Maps *Geocoding API* key | Google Cloud Console (restrict the key to your API server IP) | API env `GOOGLE_MAPS_API_KEY` + `GEO_PROVIDER=google`. Without it, free OpenStreetMap search is used (fair-use limits) |
| **Map tiles (optional upgrade)** | tile URL template, e.g. MapTiler/Mapbox/Stadia | provider dashboard | Frontend env `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION` |
| **Error / uptime monitoring** | Sentry DSN, UptimeRobot monitor on `https://api.aran.co/api/v1/health` | sentry.io / uptimerobot.com | monitoring dashboards |
| **Legal identifiers** | FSSAI no., GST no., business address, grievance contact | your licences | footer / legal pages / invoices |

## 1. How the system fits together

| Piece | Who uses it | URL |
|---|---|---|
| Customer storefront (PWA) | Customers | `https://aran.co` |
| Admin console | Owner / manager / staff | `https://aran.co/admin` |
| Delivery partner app | Riders (mobile OTP login) | `https://aran.co/delivery` |
| API + realtime (Socket.IO) | All of the above | `https://api.aran.co` |
| MongoDB Atlas | API only | – |

Login model: **customers and riders sign in with a mobile OTP** (6-digit code by SMS, 5-minute expiry, 5 attempts, 30 s resend, 5 codes/hour/number). **Owner/manager/staff use email + password** (never OTP). Delivery to the customer is completed only when the rider enters the customer's 4-digit **handover code**.

## 2. Required third-party services

| # | Service | Why | Recommended | Cost (approx.) | Where to configure |
|---|---|---|---|---|---|
| 1 | **Domain** | brand + HTTPS | any registrar, DNS on Cloudflare | ₹800–1,500/yr | DNS: `aran.co` → Vercel, `api.aran.co` → API host |
| 2 | **Frontend hosting** | serves the React PWA | Vercel (free tier ok) | free–$20/mo | `frontend/` root, build `npm run build`, env `VITE_API_URL` |
| 3 | **API hosting** (Node, always-on, WebSockets) | Express + Socket.IO + timers | Render / Railway / a small VPS | $7–25/mo (must NOT sleep) | `render.yaml` provided |
| 4 | **MongoDB Atlas** | database | M10+ for production (backups) | ~$57/mo (M10); M0 free is for testing only | `MONGODB_URI` |
| 5 | **SMS gateway for OTP** | mobile login | **MSG91** (or Twilio) | ~₹0.15–0.25/SMS | Admin → Settings → SMS & OTP login |
| 6 | **Razorpay** | online payments + refunds | Razorpay (KYC-approved live account) | 2% per txn | Admin → Settings → Payment gateway |
| 7 | **Cloudinary** | product / hero photo storage + CDN | Cloudinary free→Plus | free–$89/mo | server env `CLOUDINARY_*` |
| 8 | **Transactional email** (receipts, password reset) | optional but expected | Resend / AWS SES / Zoho | free–$20/mo | server env `SMTP_*` |
| 9 | **Error monitoring** | know when it breaks | Sentry (free tier) | free | add DSN (see §6) |
| 10 | **Uptime monitoring** | alert on downtime | UptimeRobot / BetterStack | free | monitor `https://api.aran.co/api/v1/health` |

Optional: **WhatsApp Business Cloud API** (order updates; `WHATSAPP_*`), **Web Push** (`VAPID_*`, generate with `npx web-push generate-vapid-keys`), **Cloudflare** (DDoS/WAF, free), **Google Maps API** (address autocomplete / route maps – not integrated yet).

## 3. India-specific legal & compliance (Required before taking money)

1. **FSSAI food licence / registration** (mandatory for any food business; display the licence number in the footer and on invoices).
2. **GST registration** (if turnover threshold applies) and correct tax rate in Admin → Settings (food is commonly 5%; confirm with your CA).
3. **Business bank account + Razorpay KYC** (needs PAN, bank proof, business proof).
4. **DLT registration for SMS (TRAI rule)** – you cannot send OTPs in India without it:
   - Register as a **Principal Entity** on a DLT portal (Jio / Airtel / Vodafone-Idea / BSNL) → get **Entity ID**.
   - Register a **Sender ID (header)**, e.g. `ARANCO`.
   - Register an **OTP template** such as `{#var#} is your ARAN.co verification code. Valid for 5 minutes. Do not share it.` and get the **Template ID** approved.
   - Give Entity ID / header / Template ID to MSG91 and paste the MSG91 **Auth key** + **Template ID** into the admin SMS panel. Approval takes 1–7 days – start this first.
5. **Legal pages** – the Terms, Privacy and Refund pages shipped are templates: have a lawyer review them. Add your registered business name/address and grievance officer contact (DPDP Act / consumer e-commerce rules).
6. **Allergen & ingredient accuracy** – only publish what you have verified (admin product form).
7. **Trademarks/photos** – only use photos and brand marks you have rights to (the sample Biscoff photo shows third-party branding).

## 4. Environment variables (API)

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV=production` | ✔ | enables secure cookies, hides dev OTP |
| `MONGODB_URI` | ✔ | Atlas connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ✔ | long random strings |
| `SETTINGS_ENCRYPTION_KEY` | ✔ | encrypts gateway/SMS secrets in the DB; never change after saving secrets |
| `CLIENT_ORIGINS`, `CLIENT_URL` | ✔ | `https://aran.co` (comma-separate extra origins) |
| `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` | first boot | creates the owner; remove the password var afterwards |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | for uploads | |
| `SMTP_*` | optional | email |
| `VAPID_*`, `WHATSAPP_*` | optional | push / WhatsApp |
| `SMS_PROVIDER`, `MSG91_*`, `TWILIO_*` | optional | fallback if you prefer env over the admin panel |
| `RAZORPAY_*` | optional | fallback; normally set in the admin panel |
| `BUSINESS_TZ` | optional | default `Asia/Kolkata` |

Frontend: `VITE_API_URL` (only if the API is on another origin).

## 5. Go-live runbook

1. Create Atlas cluster (M10+, enable backups, restrict network access to your API host's IPs).
2. Deploy API (Render blueprint `render.yaml`), set env vars, confirm `/api/v1/health`.
3. Deploy frontend to Vercel; point `aran.co` and `api.aran.co` DNS; HTTPS is automatic.
4. Sign in at `/admin/login` with the owner account → **change the password**.
5. Admin → **Settings**: brand name, address, coordinates, timings, delivery radius/PIN codes/fee, tax, pickup slots.
6. Admin → **SMS & OTP login**: provider + keys → *Send test* to your phone → sign in at `/login` with OTP.
7. Admin → **Payment gateway**: Razorpay live keys → *Test connection*; add the shown webhook URL in Razorpay with the same secret (events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`).
8. Admin → **Categories / Products / Homepage hero**: confirm the four signature items' **prices** (seeded defaults ₹179 / ₹169 / ₹149 / ₹199 are placeholders), upload photos, set availability and stock.
9. Admin → **Delivery** → add riders (name + mobile). Each rider opens `/delivery` on their phone, signs in by OTP and switches **On duty**.
10. Place a real test order end-to-end: online payment (₹1–10), accept in admin, assign rider, rider picks up, customer code → delivered, then refund it from admin.
11. Run `npm test` in `backend` and `frontend`, and `npm run test:e2e`, before every release; run Lighthouse on the live URL and fix anything below your targets.

## 6. Operations you should set up

- **Backups:** Atlas continuous backups; test a restore once.
- **Monitoring:** Sentry (frontend + API), UptimeRobot on `/api/v1/health`, Render/Railway log drains.
- **Alerts:** low-stock and failed-payment alerts already appear in the admin notification bell; add email/WhatsApp for the kitchen.
- **Security:** keep dependencies updated (`npm audit`), rotate secrets if anyone leaves, give staff the lowest role that works (staff < manager < owner), review the audit log (Admin API `/admin/audit-log`).
- **Reconciliation:** the API exposes `POST /admin/payments/reconcile` to match Razorpay captures to orders; run it daily or schedule it.
- **Scale-out note:** the API keeps Socket.IO rooms and some rate-limit counters in memory. To run more than one API instance, add the Socket.IO Redis adapter and a Redis-backed rate-limit store.

## 7. Built vs. still open

**Built and tested (automated tests, mocked providers):** mobile OTP login with SMS fallback provider; rider app with handover code and live GPS; **live rider map** on the customer's order page (OpenStreetMap tiles by default); **address search + "use my location"** (server-side proxy, cached, swappable to Google); **auto-dispatch** of riders (toggle in Settings → Delivery; picks the least-loaded rider who is on duty, ties broken by distance to the kitchen; manual "Auto-assign" button on each order); **rewards points and referrals** (earn on completed orders, redeem at checkout up to a cap, points returned on cancellation, referral bonus paid once after the friend's first completed order; all values editable in Settings → Rewards & referrals).

**Still open / needs a decision or credentials:**
- Real SMS delivery, real Razorpay payments, real geocoder/map tiles have only been exercised against mocks: do one live test of each before launch.
- OpenStreetMap's public search and tile servers are for light use. At real volume, switch to Google/Mapbox/MapTiler (see §0).
- Referral codes are shared by link (`?ref=CODE`) and applied at sign-up; there is no fraud scoring beyond one reward per new account and one per phone number.
- OTP has no voice/WhatsApp channel (two SMS providers can be configured as fallback for each other).
- Multi-instance scaling needs a Redis adapter for Socket.IO and rate-limit counters (§6).
- POS integration, multi-branch, subscription plans and personalised recommendations are intentionally not built.