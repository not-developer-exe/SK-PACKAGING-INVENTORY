# SK Packaging ERP

Full-stack inventory, manufacturing, dispatch, invoicing and management reporting application.

## Application structure

- `Client/`: React 19 + Vite frontend.
- `Server/`: Express 5 API, Mongoose and MongoDB.
- `docker-compose.yml`: production-oriented container deployment.
- `DEPLOYMENT.md`: deployment and operational checklist.

## Important database requirement

The API uses multi-document MongoDB transactions for stock movements, invoicing, payments, cancellations, audit records and other workflows. Configure `MONGODB_URI` to a MongoDB replica set (MongoDB Atlas is recommended). A standalone MongoDB server is not supported.

## Quick local development

1. Configure `Server/.env` using `Server/.env.example`.
2. Run `cd Server && npm ci && npm run dev`.
3. In another terminal, run `cd Client && npm ci && npm run dev`.
4. Open the Vite URL shown in the terminal.

## Production deployment

Follow [DEPLOYMENT.md](DEPLOYMENT.md). Never commit real environment files, passwords, database credentials or JWT secrets.
