# Visual smoke test

Unit tests cannot see a note overlapping a card border, a sentence cut off mid-way, a header
wider than a phone or a 3D preview that stays black. This smoke opens every customer page in
Chromium against the production build and checks for exactly that class of problem.

## What it checks

Each page in `smoke.spec.mjs` runs at 1366 px and 390 px:

1. The page never scrolls sideways (`scrollWidth <= innerWidth`).
2. No `pageerror` and no console error (the anonymous `401` of `GET /api/account` is expected).
3. No `p`, `a`, `button`, `h1`-`h3`, `dd` with `nowrap` or `overflow: hidden` clips its text.
4. German pages: no paragraph ends in a dangling preposition (` an`, ` zu`, ` per`, ` mit`, ` für`).
5. No two identical buttons or links inside one card (header, footer and navigation are exempt).
6. On the upload steps the viewer `<canvas>` draws something (compared with the page behind it).
7. A full-page screenshot per page and width lands in `e2e/screenshots/` (git-ignored; CI uploads it).

Pages: landing, upload (dropzone, configuration, loading, quote, quote with quantity 4), cart,
checkout (signed in through the stub, and signed out: redirect to the login), login, account (orders,
one order, address, password, signed in through the stub),
about, imprint and the French landing page.

## Run it

```
cd pod-frontend
npm ci
npx playwright install chromium     # once; add --with-deps on Linux CI
npm run e2e:smoke                   # builds first if dist/ is missing
```

`npm run e2e:smoke -- -g "upload-quote"` passes arguments on to Playwright. The HTML report is
written to `e2e/report/` (`npx playwright show-report e2e/report`). A full run takes about
three minutes, most of it software-rendered WebGL.

The run uses three local ports (override with `E2E_PORT`, `E2E_SSR_PORT`, `E2E_MOCK_PORT`):
`mock-api.mjs` answers `/api/*` with fixtures shaped like `src/app/core/api/openapi.d.ts`, the SSR
build serves the pages, and `serve.mjs` is the front proxy joining both. The run builds first when `dist/` is missing or
older than anything in `src/`, `public/` or `angular.json`; `E2E_SKIP_BUILD=1` never builds (CI
tests the build artifact of the previous job).
`STUB_ACCOUNT=1` starts the mock with a signed-in customer; the spec toggles it per page.

## Add a page

1. Add an entry to `PAGES` in `smoke.spec.mjs`: `name` (used for the screenshot), `open(page)`
   that brings the browser to the state, `german: true` for German copy, `viewer: true` when a
   canvas must draw, `account: true` for pages that need a signed-in customer.
2. Add an endpoint to `mock-api.mjs` if the page calls one it does not know; keep the shape
   exact against `openapi.d.ts`.
3. Run `npm run e2e:smoke -- -g "<name>"` and look at `e2e/screenshots/<name>-*.png`.
