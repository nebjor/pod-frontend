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

Only the GLB is part of the shop (the landing page renders it); the STL and 3MF are kept for
the curl examples below and the backend's real-slicer test, and `angular.json` leaves them out
of the build so they do not ship in the production image.

## API contract and generated models

The backend publishes its OpenAPI document at `/v3/api-docs` (browsable at `/api-docs`).
The frontend's response models are aliases of `src/app/core/api/openapi.d.ts`, which is generated
and committed. After a backend DTO change, regenerate it against a running backend and review
the diff; a changed shape then fails the Angular build where it matters:

```powershell
npm run api:types                                   # backend on http://localhost:8080
$env:BACKEND_URL = "http://backend:8080"; npm run api:types   # inside the frontend container
```

## Quote API
The upload page sends the selected model to the backend, which slices it with the bundled
Bambu Lab A1 profiles and returns a priced quote. The Angular dev server proxies `/api` to the
backend (`proxy.conf.js`, target from `BACKEND_URL`), so no CORS configuration is needed.

| Endpoint | Purpose |
|---|---|
| `POST /api/quotes` (multipart: `file`, `filament`, `color`, `quality`, `quantity`) | Quote an uploaded STL/3MF |
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

## Cart
`/warenkorb` lists the models the customer configured. "In den Warenkorb" on the upload page
adds the model as a line (file, model id, filament, colour, quality, quantity and the quote
the backend gave); the header shows pieces and total and links to the cart. On the cart page
a changed quantity asks the backend for a new quote for that line; an order holds at most 10
lines and the catalogue's `maxQuantity` per line.

The cart survives a reload of the tab: line metadata and quotes live in `sessionStorage`
(`pod.cart`), the model files in IndexedDB (`pod-cart`), so an expired model can be uploaded
again without asking the customer. Both are read after the first render in the browser; the
server renders an empty cart. A line whose file is missing from IndexedDB is dropped.

## Orders API
The checkout page turns the cart into an order. The backend recomputes every price from the
uploaded models (the customer's number is only checked), stores the models under UUIDs in the
`order_files` volume and keeps the full price breakdown on the order.

| Endpoint | Purpose |
|---|---|
| `POST /api/orders` (JSON: `customer`, `items[]` with `modelId` from `POST /api/models`, `expectedTotalChf`) | Place an order, `201` with the order |
| `GET /api/orders/settings` | Shipping flat rate, VAT switch, quote validity, shipping countries |
| `GET /api/orders/{number}?email=` | Look up an order with the customer's e-mail |

`400` carries an `errors` map per field, `404` with `code: model-expired` and `itemIndex` names
a model the backend no longer keeps (the checkout uploads it again and retries once), `409`
carries the recomputed quotes (`currentQuotes`) and `totals` when the price changed.

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
curl.exe -F "file=@public/3DBenchy.stl" http://localhost:8080/api/models   # take modelId from the answer
curl.exe -H "Content-Type: application/json" -d '{"customer":{"name":"Anna Muster","email":"anna@example.com","street":"Bahnhofstrasse 1","postalCode":"8001","city":"Zuerich","country":"CH"},"items":[{"modelId":"<modelId>","fileName":"3DBenchy.stl","filament":"PLA","color":"red","quality":"medium","quantity":2}],"expectedTotalChf":11.00}' http://localhost:8080/api/orders
```

### Order status page
`/bestellung` ("Meine Bestellung") looks an order up with `GET /api/orders/{number}?email=`,
the two things the order mail carries; the mail links to `/bestellung?nr=<number>&email=<email>`,
and with both present the page asks right away. It shows a status timeline (Neu, Bezahlt,
In Pruefung, Freigegeben, Im Druck, Versendet; Storniert instead of the steps), the lines, the
totals and the dates, and for a `NEW` order with a `paymentUrl` a "Jetzt bezahlen" link. A `404`
reads "Keine Bestellung mit dieser Nummer und E-Mail gefunden", whichever of the two was wrong.

## Customer account
Passwordless: `/konto/anmelden` asks for the e-mail, `POST /api/account/login-links` answers
`202` either way and mails a link to `/konto/anmelden?token=<token>`; opening it calls
`POST /api/account/sessions`, which sets the HttpOnly cookie `pod_session`. `?returnTo=<path>`
(paths of this app only) says where to go afterwards, `/konto` otherwise; because the mail
carries only the token, the login page keeps the path in `localStorage` (`pod.loginReturnTo`)
until the link is opened.

| Endpoint | Purpose |
|---|---|
| `GET /api/account` | The account, or `401 not-logged-in` |
| `PUT /api/account` (`name`, `street`, `postalCode`, `city`, `country`) | Save the delivery address, `400` with `errors` per field |
| `GET /api/account/orders` | The account's orders (`OrderResponse[]`) |
| `DELETE /api/account/sessions` | Log out |
| `DELETE /api/account` | Delete the account; the orders stay |

`AccountService` asks `GET /api/account` once after the first render in the browser (never
during prerendering) and keeps `state` as `unknown`, `loading`, `anonymous` or `signedIn`; a
`401` is the anonymous visitor, not an error. The header shows "Anmelden" or "Mein Konto" once
the state is known. `/konto` lists the orders newest first (linking to the status page), holds
the address form, logout and "Konto loeschen" with a confirm step; an anonymous visitor is sent
to the login. The checkout prefills empty address fields from the account and shows "Angemeldet
als"; a visitor sees "Schon Kunde? Anmelden" with `returnTo=/checkout`. The account types are
hand-written in `src/app/core/account/account.models.ts` until the generated contract carries them.

### Protection against runaway slicing
- At most two slicer processes run at once (`slicer.capacity.max-concurrent`); a request that
  cannot get a slot within 20 s gets `503` with `Retry-After`.
- Each client address may start 10 slicer runs per minute and 100 per hour (`rate-limit.*`);
  beyond that the API answers `429` with `Retry-After`, `retryAfterSeconds` and, when
  `SUPPORT_EMAIL` is set, `supportEmail` in the problem details. The upload page shows both.
- Finished quotes are cached for an hour by model hash and parameters, so repeated requests
  do not start the slicer and do not count against the limit.
- Limits live in memory: restarting the backend resets them. The admin area has a button to
  reset them without a restart (`POST /api/admin/rate-limits/reset`, owner login required).

## Admin area
`http://localhost:4200/admin` is the owner's view: order list with status filter, details with
address and payment, download of the uploaded model, and buttons that move an order along
`NEW → PAID → IN_REVIEW → PRINTING → SHIPPED` (or cancel it). Shipping starts the 90-day
retention clock.

Login is HTTP Basic against `/api/admin/**` with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from the
environment; the browser keeps the credentials for the tab only. With a blank password the
admin API answers `401` to everyone. Set it in your shell before starting the stack:

```powershell
$env:ADMIN_PASSWORD = "choose-something-long"; docker compose -f docker-compose.local.yml up -d backend
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
