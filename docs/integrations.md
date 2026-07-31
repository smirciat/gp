# Gold Points integration APIs (resBering + bering_public)

**Base URL:** `https://gp.beringair.com`

Machine-to-machine routes mounted **before** `lusca` CSRF in `server/routes.js`. Intended for:

| App | Route prefix | Audience |
|-----|--------------|----------|
| resBering desktop | `/api/integrations/resbering/v1` | Employees at cargo/ticket counter |
| bering_public mobile | `/api/integrations/bering-public/v1` | App Store customers booking for themselves |

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
| `POST` | `/redeem` | Tier-based redemption against a booking |

### Membership lookup

**resBering** — `email` and/or `userId` (employee can look up any member).

**bering_public** — `email` or `userId` (must match the signed-in customer in the calling app).

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
- **Freight** — `redemptionType: "freight"`; tier must include `freightLbs` or `freight` benefit (tiers 10–100).
- **Fare** — `redemptionType: "fare"`; tier must include ticket discount, companion fare, or airline ticket benefit.

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

# Tier redemption (bering_public)
curl -s -X POST -H "Authorization: Bearer $BERING_PUBLIC_INTEGRATION_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"member@example.com","tierPoints":10,"redemptionType":"freight","booking":"ABC123"}' \
  'https://gp.beringair.com/api/integrations/bering-public/v1/redeem'
```

## Server modules

| File | Role |
|------|------|
| `server/api/integration/membership.service.js` | Email/userId lookup, primary/associate group, redeemable balance |
| `server/api/integration/rewards.service.js` | Tier catalog and fare/freight validation |
| `server/api/integration/redeem.service.js` | Pool vs own-account debit + `newTransaction` |
| `server/api/integration/integration.auth.js` | Per-app API tokens |

Reward tiers follow the Bering Air Gold Points marketing program (10–1000 points).

## Client logic not duplicated here

The legacy Angular `main.controller.js` still owns staff-only flows (create member, associate management, flight award batch, transfers, transaction edit/delete). Integration APIs only cover **lookup**, **available rewards**, and **tier redemption**.

## CORS

Browser clients calling `gp.beringair.com` directly may need extra origins in `local.env.js`:

```js
INTEGRATION_CORS_ORIGINS: 'https://reservations.beringair.com'
```

`gp.beringair.com` and `reservations.beringair.com` are allowed by default in `server/app.js`.
