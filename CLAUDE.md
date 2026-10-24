# pod-frontend — working conventions

Angular 21 frontend of the 3DBurg print-on-demand shop (3dburg.ch). The Angular workspace is
the repository root (`src/`, `public/`, `e2e/`); `deploy/` holds the production compose stack
for both repositories and `docker-compose.local.yml` the local development stack. `AGENTS.md`
is the Angular team's general best-practice list; this file holds the project's own rules. The backend is the sibling repository `cad-slicer-engine`; its
`docs/ROADMAP.md`, `docs/architecture.md` and `docs/adr/` are the source of truth for scope
and decisions. Read an ADR before changing what it decided.

## Commands

- `npx ng test --watch=false` — Vitest unit tests; must be green before a PR.
- `npx ng build` — production build with the budgets in `angular.json`; no new warnings.
- `npm run e2e:smoke` — visual smoke against the prerendered build with the mock API
  (`e2e/`); run it after any template or style change.
- `OPENAPI_FILE=<path>/openapi.json npm run -s api:types` — regenerate `src/app/core/api/openapi.d.ts`
  from the backend contract. Never edit that file by hand; hand-written overlays live next to
  the models that need them (`account.models.ts`).

## Language and text

- Code, comments, commit messages, PR texts, docs: English. No German words in identifiers.
- Everything a customer reads goes through the i18n dictionaries `src/app/core/i18n/{de,fr,it,en}.ts`
  via the `t` pipe or `I18nService.t`. German is the source and uses real umlauts (ä ö ü) and
  `ss`, never `ae/oe/ue` or `ß`. French uses "vous", Italian "tu", English "you".
- Every key exists in all four dictionaries; the completeness spec fails otherwise. No empty
  strings. Product names (3DBurg, Bambu Lab A1, PLA, PETG, PCTG, STL, 3MF) stay as they are.
- The admin area (`src/app/features/admin/`), `public/llms.txt`, `sitemap.xml` and the legal page bodies
  stay German on purpose.
- Dates are `dd.MM.yyyy` and prices `CHF 8.15` in every language.

## Architecture rules

- Zoneless, standalone components, signals; `ChangeDetectionStrategy.OnPush`. State in
  services with signals, templates read signals. No `zone.js`, no `BehaviorSubject` for UI state.
- Every route prerenders (`app.routes.server.ts` uses `**`). Browser-only work (storage,
  WebGL, `window`) runs after the first render (`afterNextRender`) and is guarded for SSR.
- `src/app` has four layers: `core/` (app-wide singletons: api types, config, i18n, seo, routing,
  quote, order, account, cart), `layout/` (header, footer), `shared/` (reusable UI such as the
  model viewer, shared style sheets) and `features/` (one folder per routed area, grouped by
  feature).
- Import direction: `features` may use `core`, `layout` and `shared`; `layout` and `shared` use
  only `core`; `core` imports none of the other three; no feature imports another feature (a
  piece two features need moves to `core` or `shared`). Cross-layer imports use `@core/*`,
  `@layout/*`, `@shared/*`, `@features/*`; inside a folder they stay relative. The root files
  (`app.*`) wire the layers together.
- Routed components are `<name>-page.component.ts` (class `<Name>PageComponent`, selector
  `app-<name>-page`); non-routed components keep `.component` without `-page`.
- Facts live once: prices, limits and status names come from the backend (`/api/orders/settings`,
  `/api/quotes/options`, generated types), never from literals in templates.
- Customer-facing pages are page content, not modal dialogs. Steps replace content inside the
  page; header and footer stay.
- Per-component style budget is 10 kB (warning). Split a component instead of raising it.

## Tests

- Tests pin behaviour the customer or owner sees: texts, links, states, requests sent. Do not
  assert private methods or call counts of internals.
- A bug fix comes with the test that would have caught it.
- Specs use the real German texts; language-dependent assertions use the `de` dictionary.
- WebGL cannot run in jsdom: the viewer is checked through the e2e smoke, not unit tests.

## Git and review

- One feature or fix per branch from `main`, PR against `main`, no stacked PRs, no direct
  pushes. Squash is not used; keep commits meaningful. Commit messages explain why, in English,
  and end with the Co-Authored-By trailer when written by Claude.
- Before merging a PR written by a subagent, run `/code-review` on it and look at the pages it
  touched (screenshots at 1366 px and 390 px). Unit tests and a green build are not enough for
  layout and copy.
- Delete what a change makes obsolete (code, keys, specs, docs) in the same PR.
- Deploy with `deploy/update.sh` on the server (backup, pull both repositories, build,
  migrate, smoke). Backend and frontend ship together when a contract field changes.

## Things that look like bugs but are decisions

- Quotes slice once per model and quality; quantity and material are arithmetic (ADR 0006/0007).
- The setup fee is charged once per order, CHF 5 guest / CHF 3 signed-in (ADR 0009); quotes
  show the model price only.
- The cart lives in localStorage + IndexedDB and syncs to the account when signed in (ADR 0010).
- The header hides nothing on phones; the upload button shows a short label below 480 px.
