# Production deployment

This repository includes Dockerfiles and Compose configuration for a single-host deployment. The frontend is served by Nginx and proxies `/api` to the Express API, so the browser uses same-origin HTTP-only authentication cookies.

## 1. Prepare MongoDB

Use MongoDB Atlas or another managed MongoDB replica set. The application requires transaction support; do not use a standalone MongoDB instance.

Create a database user with access only to the ERP database. Add the deployment host's outbound IP to the database network allowlist. Keep the connection string private.

## 2. Configure the API environment

Copy `Server/.env.example` to `Server/.env` and set:

- `MONGODB_URI`: replica-set connection string for the production database.
- `GST_STATE_CODE`: the two-digit state code of the company's GST registration (or set `GSTIN` and the API will read its first two digits). Invoice creation is blocked until this is configured.
- `JWT_SECRET`: a unique random secret of at least 32 bytes.
- `ADMIN_EMAIL`: `official.additya.singh@gmail.com`.
- `ADMIN_PASSWORD`: a unique password of 12–128 characters.
- `ADMIN_NAME`: owner display name.
- `CLIENT_ORIGINS`: the exact public origin(s), e.g. `https://erp.example.com`.

Do not use angle-bracket placeholders or commit `Server/.env`. Use a password manager or hosting secret store for credentials.

## 3. Build and start

Install Docker Engine and the Docker Compose plugin on the host. From the repository root:

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f server
```

The frontend is exposed on port `8080` by default. Set `APP_PORT` in the shell or Compose environment to change it. Put a TLS reverse proxy (for example, Caddy or a managed load balancer) in front of this port and terminate HTTPS there. Do not expose the API container port directly.

## 4. Owner account

On first startup, the API creates the configured owner account if it does not exist. If it already exists as a compatible password account, it is ensured to remain an active administrator; its password is not reset. If migrating a legacy external-auth account, follow the server seed instructions and preserve a database backup first.

## 5. Verify deployment

- Open `https://your-domain/` and sign in.
- Check `https://your-domain/api/health` returns HTTP 200 with database connected.
- Verify the owner account is an active admin.
- Verify login persists after refresh (HTTP-only secure cookie).
- Run a controlled test of inward, conversion, production, dispatch, invoice and payment workflows using test records before live factory use.
- Confirm archive/restore and cancellation workflows on test parties and batches.
- Verify daily/monthly reports and physical stock reconciliation.

## 6. Backups and operations

- Enable automated MongoDB backups and point-in-time recovery where available.
- Restrict database network access and rotate credentials if exposed.
- Monitor container health and logs; keep a rollback image/tag before each release.
- Back up before schema or migration work.
- Never store production database data or secrets in Git.

## 7. Update and rollback

```bash
git pull origin main
docker compose build
docker compose up -d
docker compose ps
```

Keep the previous image and a database backup until the new release has passed smoke checks. Application rollback does not automatically reverse database writes.
