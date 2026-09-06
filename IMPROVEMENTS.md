# App improvements

The seller dashboard now uses listing and order API data. Paid sales, pending
orders, orders to pack, and delivered orders replace placeholder metrics.
Unavailable data produces a retry message instead of invented totals.

Product drafts are saved on the device under the signed-in user's account.
Photos, completed recordings, descriptions, price, and quantity can be resumed.
Storage writes are serialized; failed saves are visible. Starting another product
requires confirming that the existing draft should be discarded.

Listings, discovery, orders, product detail, and checkout now distinguish failed
requests from empty results. Checkout validates required fields, Indian mobile
numbers, pincodes, and state codes. Photo enhancement failure preserves the
successful original upload. Hosted image URLs are no longer prefixed with the
API host, and uploads support both web and native FormData.

Marathi product text is preserved through generation, publication, search,
editing, cart, and order snapshots. Older products remain valid and use available
text when a translation is missing. New recovery messages are translated into
English, Hindi, and Marathi. Shared inputs and buttons expose accessible names.

## Database

Migration `6ce335b20a88` adds nullable `listings.title_mr`,
`listings.description_mr`, and `order_items.title_mr` fields. It has been applied
and verified on this workspace's connected database. Other environments need
`python -m alembic upgrade head` from `backend` before running the updated backend.
No existing product or order text is backfilled or removed.

## Verification

- Frontend: `npm test` and `npm run typecheck` from `frontend`.
- Backend: set `DEBUG=true` in the test process, then run
  `python -m pytest tests/test_llm_service.py tests/test_catalog.py tests/test_listing.py tests/test_product_languages.py tests/test_marketplace.py tests/test_marathi_migration.py -q`.
  Tests use an isolated in-memory SQLite database.
- Expo web and Android exports exercise platform bundling. Export artifacts are
  local checks, not deployed releases or installable APKs.

Device checks still needed: take a photo, interrupt an upload, resume a recording
after restarting, change accounts and verify draft isolation, publish in Marathi,
and complete a test purchase. The in-app browser tool was unavailable during
this session, so interactive browser and hardware checks were not performed.
