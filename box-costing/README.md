# SK Packaging — Box Costing & Specification Workspace

A standalone, offline-first corrugated box costing workspace.

## Run locally
Open `index.html` for basic online/local testing. For installable PWA and service-worker offline caching, serve this folder over HTTPS or localhost (for example, `npx serve .` from this directory).

## Current capabilities
- Responsive estimator workspace and unfolded sheet cutting illustration
- 2-Sheet Jointed and 1-Sheet RSC sizing modes
- Configurable dimension units and sheet rounding / manual override
- 3-ply, 5-ply and 7-ply layer models
- Layer-wise weight, base cost, rupee profit and batch calculations
- Factory flute consumption factors: Narrow 1.50×, Broad 1.60×, Fine E-Flute 1.35×
- Local Paper Rate Master, GSM sample checker, saved estimates, CSV export and copy quote
- Browser localStorage persistence and service-worker shell caching

## Important calculation note
Flute take-up increases the flute-paper consumption length only. It is not applied as a multiplier to the GSM of the whole board. For a 100-inch liner reference, Narrow consumes 150 inches of flute paper and Broad consumes 160 inches.

## Current integration boundary
ERP synchronization is intentionally not connected yet. The ERP repository's live purchase/stock valuation schema and authorized read path must be mapped before enabling live rate imports. This build does not invent or hard-code ERP purchase rates.

## Known next implementation items
- Add a dedicated, independent Roll #2 / Roll #3 configuration and validate 7-ply layer order against the factory's actual board construction.
- Refine the cutting blueprint with exact panel/flap geometry and production-specific crease/slot allowances.
- Add robust unit tests against real factory sample boxes and measured paper weights.
- Add secure, read-only ERP rate synchronization with timestamped local cache and conflict handling.
- Add import/export backup for local rate master and estimate records.
