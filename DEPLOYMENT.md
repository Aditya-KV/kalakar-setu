# Kalakar Setu — Production Deployment Guide

This walks through taking the app from "running on my machine" to "installable
by real users on real networks." It's split into: deploy the backend, point
the app at it, build a signed Android app, and a pre-launch checklist.

Current state this guide assumes: FastAPI backend running locally, Supabase
Postgres already provisioned (`backend/.env` → `DATABASE_URL`), Firebase
phone-auth project (`kalakar-setu`) already set up, no EAS project configured
yet, no production secrets generated yet.

---

## Part A — Deploy the backend

The backend can't stay on `localhost` — no phone off your dev machine's WiFi
can reach it. It needs a real host with a public HTTPS URL.

### A.1 Pick a host

**Recommended: Render** (simplest for a FastAPI + Postgres app, generous free
tier for testing, easy env var management). Railway or Fly.io work the same
way if you prefer them — the steps below map directly.

⚠️ **Resource note:** `requirements.txt` includes `opencv-python-headless`,
`onnxruntime`, and `rembg` (background removal downloads a ~170MB model on
first use). The smallest free-tier instances (512MB RAM) can be too tight for
this combination under load — start on at least a 1GB RAM plan, or the
`enhance` endpoint may crash/OOM the first time it's called.

### A.2 Prepare the repo for deployment

1. Add a start command. Render needs to know how to run the app — either
   add a `backend/Procfile`:
   ```
   web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
   or set the start command directly in Render's dashboard (same command).
2. Confirm `backend/requirements.txt` is what gets installed (it already is —
   no `pyproject.toml`/Pipfile in play).
3. Commit these changes if you haven't already (this project isn't a git repo
   yet — see [Part F.3](#f3-put-this-in-git) if you want version history
   before deploying).

### A.3 Create the Render service

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** →
   **Web Service**.
2. Connect your repo (push to GitHub first if it's not there yet — Render
   deploys from a git remote, not a local folder).
3. Root directory: `backend`.
4. Runtime: Python 3.
5. Build command: `pip install -r requirements.txt`.
6. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
7. Instance type: at least 1GB RAM (see A.1 note).

### A.4 Set production environment variables

In Render's **Environment** tab, set every value from `backend/.env` — but
treat these differently for production:

| Variable | Production guidance |
|---|---|
| `DATABASE_URL` | Same Supabase Session-pooler URL you already have, **or** a fresh Supabase project if you want dev/prod data fully separated (recommended once real users are involved — see [F.4](#f4-separate-dev-and-prod-data)). Keep the `postgresql+asyncpg://...` prefix and port `5432` (Session pooler). |
| `JWT_SECRET_KEY` | **Must change.** The current value (`dev-secret-key-not-for-production-use`) is public in this repo's history — anyone could forge tokens. Generate a real one: `python -c "import secrets; print(secrets.token_hex(32))"`. |
| `DEBUG` | `false` |
| `SMS_PROVIDER` | Leave as `mock` unless you've set up Twilio (real SMS costs money and needs `TWILIO_*` filled in) — phone auth itself already works for real via Firebase regardless of this setting. |
| `FIREBASE_PROJECT_ID` | `kalakar-setu` (unchanged). |
| `GROQ_API_KEY` / `GROQ_MODEL` | Same key works in production (free tier). |
| `GEMINI_API_KEY` | Optional fallback — same key if set. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | **Set these in production, even though they're blank in dev.** Render's own disk is ephemeral — anything saved to local `/uploads` is wiped on every redeploy or restart. Without Supabase Storage configured, every product photo would vanish the next time you deploy. Set up the bucket first (A.5), then fill these in. |
| `SUPABASE_STORAGE_BUCKET` | `product-media` (unchanged, once the bucket exists). |
| `CORS_ORIGINS` | Can stay as-is (`http://localhost:8081,...`) — a native Android/iOS app doesn't send an `Origin` header the way a browser does, so CORS mostly matters if you also run the Expo web build. Add your web domain here if you deploy that too. |
| `OTP_*` | Unchanged, these are fine as-is. |

### A.5 Set up Supabase Storage (required before going live)

1. Supabase dashboard → your project → **Storage** → **New bucket**.
2. Name it `product-media` (matches `SUPABASE_STORAGE_BUCKET`).
3. Mark it **Public** (product photos need to be viewable without auth).
4. Project Settings → API → copy the **`service_role`** secret key (not the
   `anon` key) → this is `SUPABASE_SERVICE_KEY`.
5. Copy the **Project URL** → this is `SUPABASE_URL`.
6. Paste both into Render's env vars (A.4) and redeploy.

### A.6 Run migrations against the production database

The schema is Alembic-managed (`backend/alembic/`), not auto-created. Before
the app can serve real traffic, run:

```bash
cd backend
# Point at whichever DATABASE_URL you're deploying against
alembic upgrade head
```

If you're deploying to the *same* Supabase project you've been developing
against, this is already done (you ran it earlier). If you provisioned a
fresh prod database (F.4), run this against that one before first launch.

### A.7 Verify

Once deployed, Render gives you a URL like `https://kalakar-setu-api.onrender.com`.
Confirm it's alive:

```bash
curl https://kalakar-setu-api.onrender.com/api/v1/reference/craft-types
```

You should get real JSON back, not a connection error.

---

## Part B — Point the app at the production backend

The frontend reads `EXPO_PUBLIC_API_URL` **at build time**, not runtime — it
gets baked into the JS bundle. There's currently no `frontend/.env`, so it's
silently defaulting to `http://localhost:8000`, which is why a build made
today wouldn't work off your dev machine.

Create `frontend/.env`:
```
EXPO_PUBLIC_API_URL=https://kalakar-setu-api.onrender.com/api/v1
```
(use the real Render URL from A.7, keep the `/api/v1` suffix — the code
strips it back off internally wherever it needs the bare host, e.g. for
image URLs).

---

## Part C — Build a signed Android app

### C.1 Install EAS CLI and log in

```bash
npm install -g eas-cli
eas login
```
(needs a free Expo account — create one at expo.dev if you don't have one)

### C.2 Configure the project

```bash
cd frontend
eas build:configure
```
This creates `frontend/eas.json`. Also update `app.json` before your first
real build:
- `expo.android.package`: change from the placeholder `com.anonymous.frontend`
  to something real, e.g. `com.kalakarsetu.app`. **This can't be changed
  later without becoming a different app** on Play Store / on users' phones,
  so pick it now.
- `expo.version`: bump for each release (`1.0.0` → `1.0.1` → ...).

### C.3 Define build profiles

Edit the generated `eas.json` so `EXPO_PUBLIC_API_URL` is baked in per
profile (don't rely on `frontend/.env` for EAS cloud builds — it isn't
uploaded; set it explicitly here instead):

```json
{
  "cli": { "version": ">= 13.0.0" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://kalakar-setu-api.onrender.com/api/v1"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://kalakar-setu-api.onrender.com/api/v1"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```
- **`preview`** → produces a plain `.apk` you can download and sideload
  directly onto any phone (this is what you want for "install on my 2
  phones and test").
- **`production`** → produces an `.aab` (Android App Bundle), the format
  Play Store requires.

### C.4 Add the production signing cert to Firebase

Phone auth verifies the app's signing certificate. A build signed with EAS's
managed credentials has a **different fingerprint** than your local debug
build, and Firebase needs to know about it or phone sign-in will fail in
the built app even though it worked in Expo Go / local dev.

```bash
eas credentials
```
Select Android → your build profile → view the keystore → copy the **SHA-1**
and **SHA-256** fingerprints. Then:
1. Firebase Console → Project Settings → your Android app
   (`com.kalakarsetu.app`, matching C.2).
2. **Add fingerprint** → paste both SHA-1 and SHA-256.
3. Download the updated `google-services.json` and replace
   `frontend/google-services.json` with it.
4. Rebuild.

### C.5 Build

```bash
# For sideloading / testing on your 2 phones:
eas build --platform android --profile preview

# For Play Store submission:
eas build --platform android --profile production
```
EAS builds in the cloud (free tier: limited builds/month) and gives you a
download link when done, or run `eas build --local` if you'd rather build on
your own machine using the `android/` folder that already exists in this repo.

---

## Part D — Distribute

### D.1 Direct install (your 2 phones, or any tester)

Download the `.apk` from the `eas build --profile preview` link, transfer it
to the phone (email/Drive/USB), open it, allow "install from unknown
sources" when prompted. Both phones now talk to the same production backend
→ same shared data, same as any two clients of one server.

### D.2 Play Store

1. [play.google.com/console](https://play.google.com/console) → create a
   developer account (one-time $25 fee) → create app.
2. Fill in store listing (screenshots, description, privacy policy URL —
   Play Store requires a privacy policy link for any app requesting phone
   number / camera permissions, which this app does).
3. Upload the `.aab` from the `production` build to an **Internal testing**
   track first — test with a small group before going public.
4. `eas submit --platform android` can automate the upload once you've set
   up a Google Play service account key (EAS walks you through this).
5. Promote internal → closed → production once you're confident.

---

## Part E — Pre-launch checklist

Run through this against the *real deployed backend*, not localhost:

- [ ] Sign up with a real phone number, receive and verify OTP.
- [ ] Complete onboarding (craft type, name, etc.).
- [ ] Create a listing through Photo Studio → confirm the photo actually
      appears in "My Products" (this was silently broken in dev before the
      Supabase Storage / upload-error-handling fixes — worth double-checking
      it's solid end to end on the deployed backend).
- [ ] Switch to buying mode, browse listings, add to cart, place a COD order.
- [ ] Switch back to selling mode, confirm the order appears under Orders.
- [ ] Kill and reopen the app — confirm the session persists (refresh token
      flow) instead of forcing a re-login.
- [ ] Check Render logs for any 500s during the above.
- [ ] Confirm product images load over the real deployed URL (not
      `localhost`) on a phone using mobile data, not just WiFi.

---

## Part F — Notes for after launch

### F.1 Rotating `JWT_SECRET_KEY`
Changing it invalidates every existing session — all users get logged out
and have to re-verify via OTP. Fine before launch; a bigger deal after.

### F.2 Future schema changes
Never edit tables by hand against production. Change the SQLAlchemy models,
then:
```bash
cd backend
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```
Review the generated migration file before running it — autogenerate is a
first draft, not always exactly right (e.g. it won't detect a column rename,
it'll see it as a drop + add).

### F.3 Put this in git
This project isn't currently a git repository. Before deploying, it's worth
initializing one (`git init`), adding a `.gitignore` for `backend/.env`,
`frontend/.env`, `frontend/google-services.json`, and `backend/venv/` /
`frontend/node_modules/`, and pushing to GitHub — Render deploys from a git
remote, and it's the only way to get real change history for a production
app.

### F.4 Separate dev and prod data
Right now dev and (if you deploy against the same Supabase project) prod
would share one database — your own test listings/orders would appear
alongside real users' data. Once real users are on the app, consider a
second Supabase project for production and keeping the current one for
development, with `alembic upgrade head` run against both.

### F.5 Known v1 scope limits (not bugs, deliberate deferrals)
- Payment is Cash-on-Delivery only — no Razorpay/UPI yet.
- No GeM/ONDC integration — this app is not connected to those marketplaces.
- No delivery-partner integration — fulfillment status is updated manually
  by the seller.

These were explicit scope decisions, not things broken in production — just
flagging so they're not mistaken for deployment bugs.
