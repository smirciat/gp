# Gold Points integration APIs (resBering + bering_public)

**Base URL:** `https://gp.beringair.com`

Machine-to-machine routes mounted **before** `lusca` CSRF in `server/routes.js`. Intended for:

| App | Route prefix | Audience | Redemption types |
|-----|--------------|----------|------------------|
| resBering desktop | `/api/integrations/resbering/v1` | Employees at cargo/ticket counter | **fare** and **freight** |
| bering_public mobile | `/api/integrations/bering-public/v1` | App Store customers booking for themselves | **fare only** (passenger tickets) |

## Authentication

Set tokens in `server/config/local.env.js` (not committed):

```js
RESBERING_INTEGRATION_TOKEN: 'long-random-string-for-resbering',
BERING_PUBLIC_INTEGRATION_TOKEN: 'long-random-string-for-bering-public'
```

Send on every request:

```
Authorization: Bearer <token>
```

or

```
X-GP-Integration-Key: <token>
```

## Endpoints (both trees)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/meta` | API identity, version, and `baseUrl` |
| `GET` | `/rewards` | Full reward tier catalog |
| `GET`/`POST` | `/membership` | Lookup member by email and/or userId |
| `POST` | `/customers/query` | Staff search (read-only summaries; `q` or structured `query`) |
| `GET` | `/customers/:userId` | Membership detail by userId (same shape as `/membership`) |
| `POST` | `/transactions/query` | Ledger rows for `userId` and/or `queryUsers` (read-only) |
| `POST` | `/members/enroll` | Create primary or associate + 10-pt signup transaction |
| `POST` | `/redeem` | Tier-based redemption against a booking |
| `POST` | `/flights/manifest` | Ingest completed-flight passengers from resBering (#92) |

### Customer search (resBering staff)

`POST …/customers/query` — Bearer token required. Does **not** dump the full roster; provide search criteria.

```json
{ "q": "smith", "limit": 50 }
```

(`search` is accepted as an alias for `q`.)

Or structured (legacy Manage Members style):

```json
{
  "query": { "email": "a@b.com", "firstName": "Ann", "lastName": "Smith", "id": "123", "account": "ACME" },
  "limit": 50
}
```

Response: `{ count, limit, customers: [{ userId, fullName, email, account, phone, gpType, primaryUserId, currentPoints, suspended, active, _id }] }`.

`GET …/customers/:userId` returns the full membership group (primary, associates, redeemable balance, available rewards).

### Transaction query (resBering staff)

`POST …/transactions/query`

```json
{ "userId": "363", "limit": 100 }
```

or household:

```json
{ "queryUsers": ["363", "41357"], "limit": 100 }
```

Response: `{ count, limit, userIds, transactions: [{ _id, userId, date, awardRedeem, points, status, booking, description, … }] }`.

**Ledger split (do not merge):** `Transaction` is the **current** ledger (from **1 May 2026**). History **before** that lives in the GP `Event` table (`member_id`, `points`, `notes`, `created` / `modified`). Staff UI shows them as two sections.

`POST …/events/query` `{ "userId": "363" }` → `{ count, userId, cutoff: "2026-05-01", events: [{ event_id, member_id, points, runningBalance, notes, created, modified }] }`.

### Member enrollment (resBering staff)

`POST …/members/enroll` — creates a new GP member without exposing raw `POST /api/customers`.

Required: `firstName`, `lastName`, `email`. Optional: `middleName`, `phone`, `dob`, address fields, `gpType` (`Primary` default or `Associate`), `primaryUserId` (required for Associate), `allowDuplicate` (default `false` — returns **409** when email already exists).

Response **201**: `{ customer, transaction, membership, duplicateEmail?, welcomeEmail? }` — 10-point signup transaction (`status: Approved`), associate linked to primary `associatedAccounts` when applicable.

**Welcome email:** when not a duplicate-email enroll, GP calls the same logic as `POST /api/things/welcomeEmail` — creates guest `User`, temp password, Mailgun send (`MAILGUN_*` on GP server). Enrollment still succeeds if email fails; response includes `welcomeEmail: { sent, skipped, reason? }`.

### Manual assign / suspend (resBering staff — Phase 5)

`POST …/transactions/assign`

```json
{
  "userId": "363",
  "points": 25,
  "awardRedeem": "award",
  "dateFlown": "8/12/2026",
  "booking": "L12345",
  "route": "OME-GAM",
  "flight": "801",
  "description": "Manual adjustment"
}
```

Response **201**: `{ points, awardRedeem, transactions[], membership }` — all rows **`Approved`** immediately (no pending queue).

`PATCH …/customers/:userId/suspension` — `{ "suspended": true | false }`.

### Membership lookup

**resBering** — `email` and/or `userId` (employee can look up any member).

**bering_public** — `email` or `userId` (must match the signed-in customer in the calling app). Membership responses omit freight tiers; use `availableFareRewards` only.

Response includes:

| Field | Meaning |
|-------|---------|
| `combinedPoints` | Total across primary + associates |
| `redeemablePoints` | Points this member can spend (own balance, or full pool if primary) |
| `redeemFromPool` | `true` when member is primary and may debit the shared pool |
| `availableRewards` | All tiers affordable at `redeemablePoints` |
| `availableFareRewards` | Fare tiers only (ticket %, companion fare, airline tickets) |
| `availableFreightRewards` | Freight tiers only (lbs allowance or ATV/snowmobile) |

### Redemption rules

- **Tier-based only** — pass `tierPoints` (10, 20, 50, 100, 200, 400, 800, or 1000), not a custom points amount.
- **Booking required** — every redemption posts against a specific `booking` number.
- **Primary** — redeems from the combined primary + associate pool (debits primary first, then associates).
- **Associate** — redeems only from their own `currentPoints`.
- **Freight** — `redemptionType: "freight"`; tier must include `freightLbs` or `freight` benefit (tiers 10–100). **resBering desktop only** — bering_public rejects freight redemption.
- **Fare** — `redemptionType: "fare"`; tier must include ticket discount, companion fare, or airline ticket benefit. Both apps.

`GET …/meta` returns `allowedRedemptionTypes`: `["fare","freight"]` for resBering, `["fare"]` for bering_public.

### Redemption request

```json
{
  "email": "member@example.com",
  "userId": "123",
  "tierPoints": 20,
  "redemptionType": "fare",
  "booking": "ABC123",
  "route": "OME-WLK",
  "flight": "101",
  "dateFlown": "7/30/2026",
  "description": "Scheduled booking discount",
  "lastUpdatedBy": 0
}
```

Response includes `tier`, `appliedBenefit`, `redeemFromPool`, `transactions`, and refreshed `membership`.

### Example calls

```bash
# Membership (resBering)
curl -s -H "Authorization: Bearer $RESBERING_INTEGRATION_TOKEN" \
  'https://gp.beringair.com/api/integrations/resbering/v1/membership?email=member@example.com'

# Tier redemption (bering_public — fare only)
curl -s -X POST -H "Authorization: Bearer $BERING_PUBLIC_INTEGRATION_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"member@example.com","tierPoints":20,"redemptionType":"fare","booking":"ABC123"}' \
  'https://gp.beringair.com/api/integrations/bering-public/v1/redeem'
```

## Server modules

| File | Role |
|------|------|
| `server/api/integration/membership.service.js` | Email/userId lookup, primary/associate group, redeemable balance |
| `server/api/integration/customers.service.js` | Staff customer search + detail (read-only) |
| `server/api/integration/transactions.service.js` | Staff transaction query (read-only) |
| `server/api/integration/rewards.service.js` | Tier catalog and fare/freight validation |
| `server/api/integration/redeem.service.js` | Pool vs own-account debit + `newTransaction` |
| `server/api/integration/integration.auth.js` | Per-app API tokens |

Reward tiers follow the Bering Air Gold Points marketing program (10–1000 points).

## Client logic not duplicated here

The legacy Angular `main.controller.js` still owns staff-only flows (create member, associate management, flight award batch, transfers, transaction edit/delete). Integration APIs cover **lookup**, **staff search/detail (read-only)**, **available rewards**, and **tier redemption**.

## CORS

Browser clients calling `gp.beringair.com` directly may need extra origins in `local.env.js`:

```js
INTEGRATION_CORS_ORIGINS: 'https://reservations.beringair.com'
```

`gp.beringair.com` and `reservations.beringair.com` are allowed by default in `server/app.js`.
