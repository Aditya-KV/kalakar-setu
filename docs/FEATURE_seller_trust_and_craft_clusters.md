# Seller Trust & Craft Cluster Features

This document covers two related, high-impact feature proposals for Kalakar Setu, plus a wider list of feature ideas considered alongside them. The two primary features are meant to reinforce each other: ratings make a cluster's sellers credible, and clusters give ratings a meaningful community to build up.

---

## 1. Seller Trust Score / Rating System

**Why:** buyers currently have no signal of seller reliability beyond the listing itself. Ratings are table-stakes for buyer confidence at any real scale, and none of Kalakar Setu's differentiators (voice listings, AI pricing, WhatsApp sharing) substitute for basic trust.

### Data model

Built on the existing `Order` / `OrderItem` / `User` tables:

- `reviews` — `id, order_item_id (FK), buyer_id, seller_id, listing_id, rating (1-5), comment, created_at`. Tying a review to `order_item_id` (not just `listing_id`) guarantees only verified buyers can leave one, and caps it at one review per purchased item.
- `review_photos` — `id, review_id (FK), media_key`, reusing the existing media upload pipeline used for listing photos.
- Denormalized aggregates on `User`: `avg_rating`, `rating_count`, recomputed on write (or a nightly job) so listing-feed queries don't need a join on every request.

### Seller-side flow

- Once an order item is marked "delivered," it becomes eligible for review (sellers cannot review themselves).
- Seller profile screen shows a ratings breakdown (5★→1★ bar chart) plus recent reviews with photos.

### Buyer-side flow

- In buyer Orders, once an item is delivered, a "Rate this purchase" prompt appears — star picker, optional comment, optional photo (reusing the existing camera/upload component from listing creation).
- Ratings surface in two places: a star badge + count on every listing card in Discover, and a full reviews section on the product detail page.

### Trust signal, not just an average

Sellers with fewer than ~3 reviews are labeled "New seller" rather than shown a potentially misleading 5.0-from-one-review — this matters most while the marketplace is still low-volume.

### Moderation

Reviews are user-generated text/photo content, so a lightweight report/hide flow (buyer or seller can flag; admin resolves) is needed rather than skipping moderation.

### Effort

Medium. New tables + two screens (rate-purchase modal, reviews list) + one reusable rating-badge component shared across Discover, product detail, and seller profile. JS/schema only — no native rebuild required.

---

## 2. Artisan Cooperative / Craft Cluster Pages

**Why:** India's handicraft economy is genuinely organized around craft-and-region communities (Channapatna toy-makers, Kutch embroiderers, Bidar's Bidriware metalworkers). No generic marketplace (Amazon, Meesho, Flipkart) models this — it's a real differentiator that also gives new sellers instant credibility ("part of the Channapatna woodcraft cluster") before they've built up their own rating history.

### Data model

- `clusters` — `id, name, craft_type, state_code, story, member_craft_names (JSON), is_active`.
- `users.cluster_id` — nullable FK to `clusters`. Null means "not part of a known cluster" — the seller behaves exactly as a normal, standalone seller today.

### Auto-assignment (no manual curation needed per seller)

Whenever a seller's `craft_types` or `state_code` changes (onboarding, or a later profile edit), the backend re-evaluates cluster membership:

1. Look up any active `Cluster` whose `state_code` matches the seller's `state_code` and whose `craft_type` is in the seller's `craft_types`.
2. If found, set `user.cluster_id` to that cluster.
3. If not found, `user.cluster_id` stays `None` — the seller is simply a normal seller, with no special handling required anywhere else in the app.

This means clusters are populated automatically as sellers onboard — no admin has to manually place anyone into a cluster.

### Buyer-facing

- A "Craft Clusters" browse surface in Discover: filterable by craft type or state, each cluster page shows its background story, its current member sellers, and an aggregated feed of their listings.
- Shareable cluster page links tie in naturally with the WhatsApp/social sharing feature already shipped.

### Seller-facing

- Seller profile shows "Your craft cluster" (auto-assigned) with the cluster's story, once matched.
- A seller who doesn't match any cluster simply sees nothing extra — zero behavior change from today.

### Effort

Medium-low on code (a filtered listings feed reusing existing marketplace-query logic). The real cost is **data quality** — an empty or thin cluster page looks worse than no feature at all, which is why real GI (Geographical Indication) data was used to seed it (see below) rather than inventing placeholder clusters.

---

## 3. How the cluster data was generated

Per your request, the cluster seed data was generated with **Scrapling** rather than hand-written, so it reflects real, documented Indian craft communities instead of guesses:

1. **Source:** Wikipedia's "Geographical indications in India" table — the authoritative public list of India's GI-tag-registered handicrafts, each with its state. This is the same real-world craft geography referenced in the feature discussion above (e.g. Channapatna toys → Karnataka woodcraft, Bidriware → Karnataka metalwork, Kutch embroidery → Gujarat embroidery).
2. **Classification:** each of the ~340 handicraft entries is matched to this app's existing craft-type vocabulary (`pottery`, `weaving`, `embroidery`, `woodwork`, `metalwork`, `painting`, `bamboo`, `leather`, `stone`, `block_print`, `jewelry`, `papier_mache`) via keyword rules on the item's name (e.g. "Bidri" / "brass" / "dokra" → `metalwork`; "sari" / "silk" / "handloom" → `weaving`). Entries that don't clearly match a known craft type, or whose state can't be mapped to this app's state codes, are skipped rather than force-fit.
3. **Grouping:** entries are grouped by `(craft_type, state_code)` — e.g. all Karnataka woodcraft GI items become one cluster — matching the cluster granularity described in section 2, rather than one cluster per individual GI item (which would be too fragmented to be a meaningful "community").
4. **Story:** for each cluster, Scrapling follows the Wikipedia link for up to 3 representative craft items in that group and pulls the lead paragraph of each article, stitching them into the cluster's background story. A cluster with no fetchable text falls back to a short generated description naming its member crafts.
5. **Output:** `backend/scripts/output/craft_clusters.json` — one row per cluster, loaded into the `clusters` table via `backend/scripts/load_craft_clusters.py` (idempotent — safe to re-run if the scrape is refreshed later).

**Files:**
- `backend/scripts/scrape_craft_clusters.py` — the Scrapling pipeline (fetch → classify → group → fetch stories → write JSON).
- `backend/scripts/load_craft_clusters.py` — loads the JSON into the `clusters` table.
- `backend/app/models/reference.py::Cluster` — the table.
- `backend/app/services/cluster_service.py` — matching/auto-assignment logic (`assign_cluster`) and read queries (`get_clusters`, `get_cluster`, `get_cluster_members`).
- `backend/app/services/profile_service.py` — calls `assign_cluster` whenever `craft_types` or `state_code` changes, in both `update_profile` and `update_onboarding`.
- `backend/app/api/routes/reference.py` — `GET /reference/clusters` (list, optional `state_code` filter) and `GET /reference/clusters/{id}` (detail + members).
- `backend/alembic/versions/134a7c958847_*.py` — migration adding the `clusters` table and `users.cluster_id`.
- `backend/tests/test_cluster_service.py` — assignment/matching tests.

**Not yet built (next steps):** the buyer-facing "Craft Clusters" browse screen and the seller-profile cluster badge are backend-ready (the API exists) but have no frontend screens yet — this was scoped to the data + backend logic + this write-up first.

---

## 4. Wider feature idea list (for context)

These were discussed alongside the two features above, roughly in order of uniqueness-to-effort:

- **Live "commission a piece" requests** — buyers post custom specs (size/color/design), nearby sellers bid or accept; turns the app into a two-way marketplace, closer to how artisan commerce already works offline.
- **Festival/seasonal demand forecasting** — reuse the existing AI pipeline to nudge sellers ("Diwali diyas sell 3x in the next 2 weeks, stock up") — a genuinely unique use of the AI already built, beyond just pricing.
- **Offline order queue** — SMS/USSD-style fallback for low-connectivity sellers, syncing when back online — directly serves the rural-seller base this app targets.
- **Buyer-to-seller voice notes** — short translated voice messages instead of text chat, matching the app's voice-first identity end-to-end.
- **GI-tag / craft-authenticity verification badge** — a manually-admin-verified badge, low build cost, strong trust signal (complementary to the rating system above).
- **AR "view in your space"** for decor/furniture items — high wow-factor, but a real engineering lift (needs a 3D/AR pipeline).
- **Buyer voice search/Q&A** in regional languages — natural extension of the existing voice + multilingual stack.
- **Group/community buying** for bulk artisan orders — interesting for B2B, but a bigger product/ops change (payments, MOQs).
