# ONDC Integration — What's Built, What's Left

Implements Milestones 1-3 from the prototype plan: **search → on_search**,
using real Listing/User data. Deliberately stops there — see "Not built yet"
below for why.

## What's implemented

- `POST /ondc/search` (mounted at `/ondc`, not `/api/v1` — this is the path
  ONDC's own network calls) — ACKs immediately, then processes in the
  background:
  - `app/integrations/ondc/service.py` — finds matching live Listings
    (grouped by seller/artisan), builds an `on_search` payload, POSTs it
    to your configured buyer callback URL.
  - `app/integrations/ondc/mapper.py` — Kalakar Setu model → ONDC-shaped
    model. **Deliberately simplified — see the warning at the top of that
    file.** It is NOT validated against the official B2B Retail API
    Contract.
  - `app/integrations/ondc/adapter.py` — a `MarketplaceAdapter` interface
    so a future GeM (or other) integration can reuse the same shape
    without touching listing/order business logic.
  - `app/integrations/ondc/client.py` — the outbound callback POST, no
    protocol signing yet.
  - `app/integrations/ondc/context.py` — builds the ONDC `context` object
    for callbacks.
- Two new tables (migrated, including against your live Supabase DB):
  - `marketplace_listings` — tracks which of your Listings are synced to
    which external marketplace (ONDC today), so one product can later
    connect to more than one marketplace without duplicating it.
  - `integration_events` — every inbound/outbound ONDC message, logged for
    debugging. Also backs idempotency (a repeated `transaction_id` +
    `message_id` won't be reprocessed).
- `backend/tests/test_ondc.py` — 3 tests, all passing: ACK response,
  end-to-end search finding a real listing and marking it synced, and a
  malformed-payload case that must never crash the endpoint.
- New env vars in `.env` / `app/core/config.py`: `ONDC_MODE`, `ONDC_DOMAIN`,
  `ONDC_SUBSCRIBER_ID`, `ONDC_SUBSCRIBER_URL`, `ONDC_BUYER_CALLBACK_URL`
  (blank = on_search is skipped/logged rather than sent — safe default).

Verified live against your real backend: POSTing the guide's own dummy
search payload returns `{"message":{"ack":{"status":"ACK"}}}`, and a real
listing created through the app gets found and marked synced in
`marketplace_listings`.

## Not built yet — on purpose

Per the prototype plan's own recommended scope ("Best Scope Right Now"),
these are deferred, not forgotten:

- `select` / `on_select`, `init` / `on_init`, `confirm` / `on_confirm` —
  Milestones 5-6. `ONDCAdapter`'s methods for these exist but raise
  `NotImplementedError`.
- Protocol signing (Authorization header, key verification) — needed
  before any real sandbox/staging, not for local mock testing.
- Real ONDC-mandatory seller fields we don't collect yet: GSTIN, PAN, a
  registered business name distinct from the artisan's own name,
  HSN/category codes per product. `mapper.py` stubs these — you'll need
  to add the real fields to `User`/`Listing` before a real submission.

## What you need to do

I can't do these — they need your own accounts/credentials:

1. **Get ONDC sandbox/mock buyer access.** Register at the ONDC dev portal
   or use the public mock buyer (`https://mock.ondc.org/`) to get a
   callback base URL, then set `ONDC_BUYER_CALLBACK_URL` in `.env` to it.
2. **Expose your local backend to the internet.** ONDC's sandbox needs to
   reach your `/ondc/search` — run `ngrok http 8000` (or a Cloudflare
   Tunnel) and use the resulting HTTPS URL as your subscriber URL wherever
   the sandbox asks for it.
3. **Validate the on_search payload in ONDC Workbench**
   (`https://workbench.ondc.tech/home`) against the *currently* published
   B2B Retail API Contract — the mapper almost certainly needs real fields
   added once you see what the Workbench flags as missing. Don't skip
   this before pointing it at anything but the mock buyer.
4. **Restart your backend server.** `--reload` didn't reliably pick up the
   new `app/integrations/` package in my testing — do a full stop/start,
   not just rely on autoreload, to make sure `/ondc/search` is actually
   live.
5. **Decide when to build select/init/confirm.** Only worth doing once
   search → on_search is confirmed working against the real sandbox, per
   the plan's own "don't start with Level 4" advice.

## Quick manual test (once your server is running)

```bash
curl -X POST http://localhost:8000/ondc/search \
  -H "Content-Type: application/json" \
  -d '{"context":{"action":"search","transaction_id":"TEST-TXN-001","message_id":"TEST-MSG-001"},"message":{"intent":{"item":{"descriptor":{"name":"pottery"}}}}}'
```

Expected: `{"message":{"ack":{"status":"ACK"}}}` immediately. Check the
`integration_events` table afterward to see what the background task did
with it (and whether it found any matching listings).
