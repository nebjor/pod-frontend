# Local Docker Compose (Frontend + Java Backend)

This setup runs:
- Angular frontend from this repository on port 4200
- Java backend from ../cad-slicer-engine on port 8080
- Postgres

## Prerequisites
- Docker Desktop running
- Backend repository cloned to: C:/Users/jnebe/Projects/cad-slicer-engine

## Start
From C:/Users/jnebe/Projects/pod-frontend/pod-frontend:

```powershell
docker compose -f docker-compose.local.yml up --build
```

This starts the minimal stack for local quote/slicer API work.

It validates that the Spring backend boots cleanly with Postgres and serves HTTP.
It also installs `bambu-studio-cli` directly into the backend container so the existing slicing service can execute it locally.

## Stop
```powershell
docker compose -f docker-compose.local.yml down
```

## Access
- Frontend: http://localhost:4200
- Backend: http://localhost:8080

## Sample Models For Local Tests
The backend container mounts the frontend sample models read-only at `/workspace/public`.

Available sample files:
- `/workspace/public/3DBenchy.stl`
- `/workspace/public/3DBenchy.3mf`
- `/workspace/public/3DBenchy.glb`

Note: the current backend slicing service is wired for STL and 3MF input paths. GLB is mounted for inspection, but not part of the current Java slicing path.

## Quote API
The upload page sends the selected model to the backend, which slices it with the bundled
Bambu Lab A1 profiles and returns a priced quote. The Angular dev server proxies `/api` to the
backend (`proxy.conf.js`, target from `BACKEND_URL`), so no CORS configuration is needed.

| Endpoint | Purpose |
|---|---|
| `POST /api/quotes` (multipart: `file`, `filament`, `color`, `quality`, `quantity`) | Quote an uploaded STL/3MF |
| `GET /api/quotes/sample?fileName=3DBenchy.stl&filament=PLA&quality=medium&quantity=1` | Quote a bundled sample model |
| `GET /api/quotes/options` | Filaments, qualities and limits the backend accepts |

Supported values: filament `PLA` or `PETG`, quality `coarse` (0.24 mm), `medium` (0.20 mm), `high` (0.12 mm),
quantity 1 to 20. The whole quantity is sliced as one batch: the CLI clones the model, arranges the copies and
spills onto further plates when they do not fit, so the quote reflects batch printing (about 18% less machine
time for 10 Benchys than 10 single prints). Slicing takes roughly one second per copy.
Pricing inputs live in the backend `application.yml` under `quote.*`.

Colours come from the backend catalogue (`catalog.colors` in the backend `application.yml`,
currently PLA in black, white, red and green and PETG in black and white) and are listed per
filament by `GET /api/quotes/options`. The upload page shows them as swatches, tints the 3D
preview and sends the chosen `color`; the backend rejects colours not stocked for the filament.
Colour never changes the slice or the price, so switching it is always a cache hit.

## Orders API
The checkout page turns the quote into an order. The backend recomputes the price from the
uploaded model (the customer's number is only checked), stores the model under a UUID in the
`order_files` volume and keeps the full price breakdown on the order.

| Endpoint | Purpose |
|---|---|
| `POST /api/orders` (multipart: `file`, print parameters, `expectedTotalChf`, customer fields) | Place an order, `201` with the order |
| `GET /api/orders/settings` | Shipping flat rate, VAT switch, quote validity, shipping countries |
| `GET /api/orders/{number}?email=` | Look up an order with the customer's e-mail |

`400` carries an `errors` map per field, `409` the recomputed quote when the price changed.

### Payment
Placing an order starts a payment session; the response carries `paymentUrl` and the checkout
sends the customer there. With `PAYMENT_PROVIDER=mock` (the default until the Stripe account is
live) that page is the shop's own `/pay/mock`, which confirms through
`POST /api/payments/mock/{session}/complete`; the success page `/checkout/success` then polls
the order until it is `PAID`. Stripe will be a second gateway behind the same interface, with
its webhook as the only way to confirm. `PUBLIC_BASE_URL` must be the origin customers see.
Commercial settings live in the backend `application.yml` under `orders.*` (shipping CHF 9.00,
VAT off, 14 days price validity, 90 days retention, shipping to CH).

```powershell
curl.exe -F "file=@public/3DBenchy.stl" -F "filament=PLA" -F "color=red" -F "quality=medium" -F "quantity=2" -F "expectedTotalChf=11.00" -F "customerName=Anna Muster" -F "email=anna@example.com" -F "street=Bahnhofstrasse 1" -F "postalCode=8001" -F "city=Zuerich" -F "country=CH" http://localhost:8080/api/orders
```

### Protection against runaway slicing
- At most two slicer processes run at once (`slicer.capacity.max-concurrent`); a request that
  cannot get a slot within 20 s gets `503` with `Retry-After`.
- Each client address may start 10 slicer runs per minute and 100 per hour (`rate-limit.*`);
  beyond that the API answers `429` with `Retry-After`, `retryAfterSeconds` and, when
  `SUPPORT_EMAIL` is set, `supportEmail` in the problem details. The upload page shows both.
- Finished quotes are cached for an hour by model hash and parameters, so repeated requests
  do not start the slicer and do not count against the limit.
- Limits live in memory: restarting the backend resets them. With `ADMIN_TOKEN` set, one client
  or all clients can be reset without a restart:

```powershell
curl.exe -X POST -H "X-Admin-Token: $env:ADMIN_TOKEN" "http://localhost:8080/api/admin/rate-limits/reset?clientKey=172.18.0.4"
```

Behind a reverse proxy set `rate-limit.trust-forwarded-headers=true` so clients are keyed by
`X-Forwarded-For`; otherwise every user would share the proxy's address.

```powershell
curl.exe -F "file=@public/3DBenchy.stl" -F "filament=PETG" -F "quality=high" -F "quantity=2" http://localhost:8080/api/quotes
```

## Notes
- Backend code is mounted as a volume and is not modified by this setup.
- This is a local dev stack. Production should use dedicated images, secrets, and non-default credentials.
- Spring datasource env is overridden to use Docker service names instead of localhost.
- `xvfb-run` is intentionally omitted because the backend feasibility note in the slicer repo already verified headless slicing without an X server.
- The backend still owns slicing orchestration. The CLI now lives in the same container because the Java service launches a local process.
