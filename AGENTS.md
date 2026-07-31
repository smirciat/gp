# Gold Points — Agent Guide

Bering Air Gold Points membership management app. Tracks members, point awards/redemptions, flight-linked transactions, and customer accounts.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | AngularJS 1.x, ui-router, ui-select, Bootstrap, Socket.io client |
| Backend | Express 4, Sequelize 6 |
| Database | SQLite (dev), PostgreSQL (prod via `SEQUELIZE_URI`) |
| Auth | Passport local JWT |
| Build | Grunt, Bower, Babel (ES2015 + class properties) |
| Tests | Karma/Mocha (client), Mocha/Supertest (server) |

Generated from [generator-angular-fullstack](https://github.com/DaftMonk/generator-angular-fullstack) v3.8.0. Preserve existing patterns unless modernization is explicitly requested.

## Repository Layout

```
client/           AngularJS app (app/, components/)
server/           Express API, auth, Sequelize models
  api/            REST resources (customer, event, flight, transaction, user, thing)
  auth/           Passport + JWT
  config/         Environment config (development, production, test)
  sqldb/          Sequelize init and model registration
e2e/              Protractor end-to-end tests
Gruntfile.js      Build, serve, test tasks
```

## Domain Modules (client routes)

| Route | Purpose |
|-------|---------|
| `/` (main) | Primary Gold Points UI — member lookup, point awards/redemptions, transactions |
| `/login`, `/signup`, `/settings` | Account auth and password management |
| `/admin` | Superadmin-only admin panel |
| `/adminGuests` | Guest admin view |

Main page views (in-controller): Manage Members, Approve Points, Add User, Assign Points, Create Member, List By Points, All Transactions, After Flight Completed.

## API Resources

REST endpoints under `/api/`:

- `/api/customers` — Gold Points member accounts and point balances
- `/api/transactions` — point awards, redemptions, approvals
- `/api/transactions/webhooks` — external webhook handler (mounted before CSRF)
- `/api/flights` — flight data queries for point assignment
- `/api/events` — event/points ledger records
- `/api/users` — user accounts
- `/api/things` — utility endpoints (manifest, integrations)
- `/auth` — authentication

## User Roles

Defined in `server/config/environment/shared.js`: `guest`, `user`, `admin`, `superadmin`.

- **guest** — member-facing access (auto-loads their account by email)
- **admin** / **superadmin** — staff operations on main page and admin routes

## Development

```bash
npm install
bower install
grunt serve          # dev server on port 9000
grunt build          # production build to dist/
npm test             # runs grunt test
```

Copy `server/config/local.env.sample.js` to `server/config/local.env.js` for local secrets (not tracked in git).

Production runs via PM2 (`ecosystem.config.js`) from `dist/server` on Node 12.

## Conventions

- **Server**: ES6 `import`/`export` with `babel-register` in dev/test. Controllers follow Rails-like REST naming (`index`, `show`, `create`, `update`, `destroy`).
- **Models**: Sequelize models in `server/api/<resource>/<resource>.model.js`; register new models in `server/sqldb/index.js`.
- **Routes**: Register new API routers in `server/routes.js`. Webhook routes mount before `lusca` CSRF middleware.
- **Client**: Angular module `goldPointsApp`. Feature areas use ui-router states. Newer components use ES6 classes with `$onInit`.
- **Field names**: Database columns use legacy names (e.g. `userId`, `gpType`, `associatedAccounts`). Match existing casing when adding fields.
- **Style**: 2-space indent, single quotes, `'use strict'`, trailing commas per JSHint/JSCS config.

## What to Avoid

- Do not upgrade Angular, Express, or Sequelize major versions without explicit request.
- Do not refactor unrelated files when fixing a targeted bug.
- Do not commit `local.env.js`, SQLite databases, or member PII exports.
- Do not change webhook or transaction approval flows without understanding downstream point-balance effects.

## Further Reading

- `docs/legacy-development.md` — guardrails for safe changes on this legacy stack
- `.cursor/rules/` — scoped Cursor rules for client, server, and tests
