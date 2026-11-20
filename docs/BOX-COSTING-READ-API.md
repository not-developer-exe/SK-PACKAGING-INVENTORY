# Box Costing Read API

Version: `v1`

These endpoints provide the separate Box Costing calculator with read-only SK Packaging paper pricing and reel stock data. They do not create, update, reserve or consume stock.

## Access control

- Every endpoint requires the ERP's existing HTTP-only `jwt` session cookie.
- The existing `protect` middleware validates the session.
- The existing `requireRole('admin')` middleware restricts access to the designated ERP owner account. Accountant users receive HTTP 403.
- Do not put an ERP password, JWT secret or reusable API key in the calculator's committed source.
- The ERP cookie is HTTP-only and uses `SameSite=Lax`. For browser integration, serve the calculator from the same site as the ERP (or through an ERP same-site reverse-proxy path) and use credentialed requests. A separate unrelated public domain will not reliably receive this cookie.

## Endpoints

### `GET /api/box-costing/v1/snapshot`

Returns paper rates, current reel stock and current Duplex facing-sheet stock in one response.

### `GET /api/box-costing/v1/paper-rates`

Returns the latest posted inward purchase rate for each exact specification (width, BF, GSM, quality), with invoice landed rate, receipt date, supplier and receipt references.

Only posted inward receipts are considered. Draft and cancelled receipts are excluded. The source rate is the rate recorded on the reel units created from the posted receipt.

### `GET /api/box-costing/v1/reel-stock`

Returns current stock grouped by exact specification. Only reels with status `available` or `partial` are included. It includes reel count, remaining kilograms and weighted-average purchase and landed rates for the remaining stock.

### `GET /api/box-costing/v1/duplex-stock`

Returns available and partially remaining `FacingMaterialBatch` records where `materialType` is `duplex`, with batch number, sheet dimensions, remaining sheet count, remaining weight, rate per kg, inward date and supplier/job-worker label.

## Response shape

```json
{
  "source": "SK Packaging ERP",
  "companyKey": "sk-packaging",
  "generatedAt": "2026-11-20T08:00:00.000Z",
  "paperRates": [
    {
      "width": 24,
      "bf": 18,
      "gsm": 120,
      "quality": "Natural",
      "latestPurchaseRatePerKg": 42,
      "latestLandedRatePerKg": 43.25,
      "purchaseDate": "2026-11-19T18:30:00.000Z",
      "supplierName": "Example Supplier",
      "receiptNumber": "IR-00001",
      "invoiceReference": "INV-001"
    }
  ],
  "reelStock": [
    {
      "width": 24,
      "bf": 18,
      "gsm": 120,
      "quality": "Natural",
      "reelCount": 3,
      "remainingWeightKg": 1450,
      "weightedAverageLandedRatePerKg": 41.8,
      "weightedAveragePurchaseRatePerKg": 40.9
    }
  ]
}
```

The values above are illustrative only.

## Calculator request

Use `credentials: 'include'` when calling the ERP API from the calculator. The user must already be signed in to the ERP as its owner. Handle HTTP 401 (sign in again), 403 (owner access required), and network/offline failures separately. Show the response's `generatedAt` as the last-sync time.

## Important costing distinction

- `latestPurchaseRatePerKg`: rate from the most recently dated posted inward receipt for that exact paper specification.
- `latestLandedRatePerKg`: latest inward rate including allocated freight and other inward charges.
- `weightedAverageLandedRatePerKg`: weighted average landed cost of the reels currently remaining in stock.

Do not silently treat these values as interchangeable. The calculator should let the user choose which rate basis is used for a quote and show the selected basis clearly.
