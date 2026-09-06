# Shipping This Update — Backend (Railway) + Frontend (EAS OTA)

This covers pushing the current uncommitted changes live: the Virtual Product
Studio pipeline (backend), the AI price suggestion feature (backend +
frontend), and the abort-to-home navigation fix (frontend). It assumes:

- Backend is already deployed on **Railway**, building from `backend/Dockerfile`.
- Frontend is an Expo app with **EAS** already configured (`frontend/eas.json`
  has `development`/`preview`/`production` build profiles and channels).
- The repo is on GitHub (`origin/main`), backend and frontend live in the
  same repo under `backend/` and `frontend/`.

If any assumption above is wrong, stop and say so before running commands —
the exact steps depend on it.

---

## Part 0 — Commit the changes

From the repo root:

```bash
git status
```

Review the output. You should see modified files under `backend/app/...` and
`frontend/app/...`, plus new files including:
- `backend/app/services/image_studio/` (new package)
- `backend/app/api/routes/pricing.py`, `backend/app/schemas/pricing.py`
- `backend/alembic/versions/fe250700b5e0_*.py` and `d9165a717e0b_*.py` (new migrations)
- `backend/scripts/test_studio_enhancement.py`
- `frontend/lib/exit-to-home.ts`

Stage and commit only real source files — do **not** add `backend/uploads/`,
`backend/*.db`, `.env` files, or any stray `*.log`/`output/` folders (these
should already be excluded by `.gitignore`; if `git status` shows them as
untracked-but-not-ignored, that's a `.gitignore` gap, not something to commit).

```bash
git add backend/app backend/alembic backend/scripts backend/.dockerignore frontend/app frontend/lib frontend/locales frontend/app.json
git commit -m "Add Virtual Product Studio pipeline, AI price suggestion, abort-to-home navigation"
git push origin main
```

---

## Part 1 — Deploy the backend to Railway

The Dockerfile's `CMD` already runs `alembic upgrade head` automatically
before starting the server on every deploy — **you do not need a separate
manual migration step.** Just confirm it succeeds in the deploy logs (Part
1.3 below).

### 1.1 Trigger the deploy

Pick whichever matches how this Railway service is actually connected:

**Option A — Railway is connected to this GitHub repo (auto-deploy on push):**
Pushing in Part 0 already triggered a new deploy. Open the Railway dashboard
→ your service → **Deployments** tab and watch the new build.

**Option B — Deploying via Railway CLI:**
```bash
npm install -g @railway/cli   # if not already installed
railway login
cd backend
railway link                  # only if this shell isn't already linked to the project
railway up
```

### 1.2 No new environment variables needed

Nothing added this session requires a new secret. One optional cleanup: if
`FAL_API_KEY` exists in Railway's environment variables from earlier
experimentation, it's no longer read by any code (the Qwen/fal.ai path was
removed) — safe to delete it from Railway's **Variables** tab, or safe to
leave it, it's just dead weight now.

### 1.3 Watch the deploy logs

In Railway's **Deployments** → the new deploy → **View Logs**, confirm you see:

```
Running upgrade ... -> fe250700b5e0, add transparent_url and processing_meta to product_images
Running upgrade fe250700b5e0 -> d9165a717e0b, add brightness and blur_score to product_images
...
Uvicorn running on http://0.0.0.0:...
```

If migrations fail here, the deploy will not come up healthy — check the
error against `backend/alembic/versions/` before retrying.

### 1.4 Know about the cold-start model download

The Virtual Product Studio's background segmentation uses a `rembg` model
(`isnet-general-use`, ~170MB) that downloads from GitHub on first use per
container — **not** baked into the Docker image. This means:
- The **first** call to `/api/v1/media/enhance/{id}` after each deploy will
  be slow (~30-90s) while it downloads.
- Every subsequent call in that same running container is fast.
- If Railway restarts/redeploys the container, the next first-call is slow
  again.

This isn't a bug, just a known limitation — worth knowing before you assume
something's broken if the first test after deploying takes a while. (If this
becomes annoying, the fix is adding a `RUN` step to the Dockerfile that
pre-downloads the model at build time — ask if you want that done.)

### 1.5 Verify the backend is actually live

```bash
curl https://<your-railway-domain>/api/v1/reference/craft-types
curl -X POST https://<your-railway-domain>/api/v1/pricing/predict \
  -H "Content-Type: application/json" -H "Authorization: Bearer <a real token>" \
  -d '{"craft_type":"pottery","title_en":"Test","description_en":"Test item","materials":[]}'
```

You should get real JSON, not a connection error or 500.

---

## Part 2 — Ship the frontend via EAS OTA (no rebuild needed)

Everything changed in the frontend this session is pure JS/TSX — no native
modules, no `app.json` native config changes — so this ships as an
over-the-air update to any existing installed build, not a new APK.

### 2.1 ⚠️ Critical: check which backend URL will get baked in

`EXPO_PUBLIC_API_URL` is read at bundle-build time, not runtime. Right now,
`frontend/.env` is very likely set to your **local dev machine's LAN IP**
(e.g. `http://192.168.0.138:8002/api/v1`) from local testing this session —
if you run `eas update` without checking this, you could ship an update that
points every user's phone at your laptop instead of Railway.

How this resolves depends on which channel you're updating:

- **`preview` and `production` channels** — `eas.json` has
  `"environment": "preview"` / `"environment": "production"` set on those
  build profiles, meaning EAS's own dashboard-managed Environment Variables
  are what get used, **not** the local `.env` file. Check what's actually
  set:
  ```bash
  cd frontend
  eas env:list --environment production
  eas env:list --environment preview
  ```
  If `EXPO_PUBLIC_API_URL` is missing or wrong there, set it:
  ```bash
  eas env:create --environment production --name EXPO_PUBLIC_API_URL --value "https://<your-railway-domain>/api/v1" --visibility plaintext
  ```
  (repeat for `preview` if you use that channel too).

- **`development` channel** — has no `environment` key in `eas.json`, so it
  falls back to the local `frontend/.env` file at the moment you run the
  update command. If you're updating this channel, temporarily edit
  `frontend/.env` to the Railway URL, run the update, then change it back
  to your LAN IP afterward for continued local dev work.

### 2.2 Find which branch each channel points to

```bash
cd frontend
eas channel:view production
eas channel:view preview
```

Each will print the branch name that channel currently serves.

### 2.3 Publish the update

```bash
eas update --branch <branch-name-from-2.2> --message "Virtual Product Studio, AI price suggestion, abort-to-home navigation"
```

Repeat for each channel/branch you want to update (e.g. once for `preview`,
once for `production`, if you use both).

### 2.4 Verify it actually reached a device

On a phone already running an installed build on that channel:
1. Fully close the app (swipe it away from recent apps, not just background).
2. Reopen it. `expo-updates` checks for a new update on cold start and
   applies it before the app finishes loading — you shouldn't need to
   reinstall anything.
3. Confirm the new features are there: Photo Studio's background selector
   and photo tips, the AI price suggestion card on the Price screen, and
   that pressing back mid-flow (e.g. from the Voice step) goes straight to
   Home.

If the update doesn't seem to apply, check `eas update:list --branch
<branch-name>` to confirm it actually published, and double-check the
device is on a build whose channel matches the branch you updated.

---

## Post-deploy checklist

- [ ] Backend: `curl` a real endpoint returns data, not an error
- [ ] Backend: deploy logs show both new migrations ran
- [ ] Frontend: correct production `EXPO_PUBLIC_API_URL` confirmed in EAS env vars (not the local LAN IP)
- [ ] Frontend: `eas update` published to the right branch(es)
- [ ] On a real device: Photo Studio → background selector + tips card render
- [ ] On a real device: Price screen → "Get AI Price Suggestion" returns a real result
- [ ] On a real device: mid-flow back (Voice or Price step) lands on Home, not the previous step
