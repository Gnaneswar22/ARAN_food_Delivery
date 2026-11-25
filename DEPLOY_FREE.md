# Free deployment: Netlify + Render + Atlas M0

Everything below is free. Trade-off: the free API sleeps after ~15 min idle, so the first visit after a quiet period takes ~30 s to wake up. Upgrade Render to Starter ($7/mo) when you go live for real.

| Part | Service | Cost |
|---|---|---|
| Website (store + admin + rider app) | **Netlify** (or Vercel; Vercel Hobby is non-commercial only) | free |
| API + live updates | **Render** web service | free (sleeps) |
| Database | **MongoDB Atlas** M0 | free |

The website proxies `/api` and `/socket.io` to the API (see `netlify.toml` / `frontend/vercel.json`), so there is no CORS setup and the login cookie works everywhere.

## Step 1: Database (Atlas)
1. Atlas -> Database Access -> create a **new** DB user for production (don't reuse the dev one).
2. Network Access -> allow `0.0.0.0/0` (Render's free tier has no fixed IP).
3. Copy the connection string: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/aran?retryWrites=true&w=majority`

## Step 2: API (Render)
1. render.com -> New -> **Blueprint** -> connect GitHub repo `Gnaneswar22/ARAN_food_Delivery` -> it reads `render.yaml` (free plan).
2. Fill the prompted variables:
   - `MONGODB_URI` = the Atlas string from step 1
   - `CLIENT_URL` and `CLIENT_ORIGINS` = your Netlify address, e.g. `https://aran-food.netlify.app` (set after step 3, then redeploy)
   - `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` = your admin login
3. Wait for "Live", then open `https://<service>.onrender.com/api/v1/health`. Copy that address.

## Step 3: Website (Netlify)
1. In the repo, replace `YOUR-API.onrender.com` with your Render host in `netlify.toml` (3 places), commit and push. (For Vercel: same in `frontend/vercel.json`.)
2. netlify.com -> Add new site -> Import from GitHub -> pick the repo. Netlify reads `netlify.toml` (base `frontend`, publish `dist`). Click Deploy.
3. Copy the site address (rename it under Site settings if you like).

## Step 4: Connect them
1. Render -> aran-api -> Environment: set `CLIENT_URL` and `CLIENT_ORIGINS` to the Netlify address (https, no trailing slash) -> save (redeploys).
2. Open the Netlify address, then `/admin/login`, sign in, **change the password**.
3. Admin -> Settings: add your real phone, email, address, hours (replaces the placeholders).
4. After first boot remove `SEED_ON_START` and `SEED_OWNER_PASSWORD` in Render.

## Troubleshooting
- Blank data / 502 on first load: the free API is waking up; wait 30 s and refresh.
- "CORS origin not allowed": the Netlify address is missing from `CLIENT_ORIGINS` on Render.
- API calls go to the wrong place: the Render host in `netlify.toml` is still `YOUR-API.onrender.com`.
