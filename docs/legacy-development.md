# Legacy development — read before changing behavior

Gold Points is a **live membership** app on a **frozen-era stack** (AngularJS 1.x, Grunt, Bower, Express 4, Sequelize 6, Node 12). It is not a greenfield project. Treat it like production avionics: **if it works, do not rip it out** because a blog post says to use something newer.

## Rules (non-negotiable for agents and contributors)

1. **Fix only what was requested.** Adding a field, column, or label does **not** authorize rewriting the server query, switching endpoints, or "cleaning up" old syntax.

2. **Reuse existing data paths.** Before adding a new API call or Sequelize `where` clause, search the repo for how the **same data** is already loaded. Use that path. Different filters on different columns are a common source of "everything broke but we only changed the UI."

3. **Do not modernize in passing.** Avoid replacing legacy Sequelize patterns, refactoring controllers to new patterns, swapping build tools, or bumping dependencies unless the user explicitly approves.

4. **When debugging, suspect the diff—not the decade-old code.** If behavior regressed during a small change, revert incidental edits first (especially server SQL and shared services), then fix forward with minimal scope.

5. **Point balances are sensitive.** Transaction create/update/approve flows affect `Customer.points` and `Customer.currentPoints`. Understand the approval workflow before changing transaction status logic.

## Domain quick reference

- **Customers** (`/api/customers`) — member accounts with point balances, associates, and `gpType` (Primary/Associate).
- **Transactions** (`/api/transactions`) — awards, redemptions, approvals; status values include `Approved`, `Pending`, etc.
- **Flights** (`/api/flights`) — flight data used when assigning points after completed flights.
- **Events** (`/api/events`) — event ledger records synced from external systems.
- **Webhooks** (`/api/transactions/webhooks`) — external integration entry point; mounted before CSRF middleware.

## Main page views

The main controller (`client/app/main/main.controller.js`) switches between staff views:

- Manage Members, Approve Points, Add User, Assign Points, Create Member
- List By Points, All Transactions, After Flight Completed

Guest-role users see only their own account data (auto-loaded by email).

## Development commands

```bash
npm install && bower install
grunt serve          # dev server (port 9000)
grunt build          # production build to dist/
npm test
```

Copy `server/config/local.env.sample.js` to `server/config/local.env.js` for local secrets.

## Where else this is documented

- `AGENTS.md` — agent entry point, stack, API resources, roles
- `.cursor/rules/project-overview.mdc` — always-on agent guardrails
- `.cursor/rules/angular-client.mdc` — client conventions
- `.cursor/rules/express-api.mdc` — server conventions
