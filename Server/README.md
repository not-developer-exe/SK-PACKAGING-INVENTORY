# SK Packaging ERP — Server

## Requirements

- Node.js 22 or later
- MongoDB configured as a replica set (the ERP uses multi-document transactions)
- A long, unique JWT secret

## Local setup

1. Copy `.env.example` to `.env`.
2. Configure `MONGODB_URI` and `JWT_SECRET`.
3. Set the owner account values:
   - `ADMIN_EMAIL`: owner login email
   - `ADMIN_PASSWORD`: unique password, 12–128 characters
   - `ADMIN_NAME`: optional display name
4. Install dependencies with `npm ci`.
5. When the database is ready, run `npm run seed:admin` once to create the owner account or promote an existing matching account to active administrator.
6. Start the API with `npm run dev`.

The admin seed command does not delete users and does not reset the password of an existing account. For an existing account, it promotes the matching email to an active administrator; the configured name is applied only when `ADMIN_NAME` is explicitly set.

## Checks

- `npm test` — domain and utility tests
- `npm run test:integration` — MongoDB-backed integration tests (requires a replica set)
- `npm start` — production API start

Do not commit `.env` or real credentials. Keep the owner password and JWT secret outside source control.
