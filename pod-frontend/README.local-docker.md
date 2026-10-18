# Local Docker Compose (Frontend + Java Backend)

This setup runs:
- Angular frontend from this repository on port 4200
- Java backend from ../cad-slicer-engine on port 8080
- Postgres by default
- Optional RabbitMQ + MinIO with the `full` profile

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

## Start (Full Infra)
If you also want queue and object storage locally:

```powershell
docker compose -f docker-compose.local.yml --profile full up --build
```

## Stop
```powershell
docker compose -f docker-compose.local.yml down
```

## Access
- Frontend: http://localhost:4200
- Backend: http://localhost:8080
- RabbitMQ UI (profile `full`): http://localhost:15672
- MinIO Console (profile `full`): http://localhost:9001

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
| `POST /api/quotes` (multipart: `file`, `filament`, `quality`, `quantity`) | Quote an uploaded STL/3MF |
| `GET /api/quotes/sample?fileName=3DBenchy.stl&filament=PLA&quality=medium&quantity=1` | Quote a bundled sample model |
| `GET /api/quotes/options` | Filaments, qualities and limits the backend accepts |

Supported values: filament `PLA` or `PETG`, quality `coarse` (0.24 mm), `medium` (0.20 mm), `high` (0.12 mm),
quantity 1 to 20. The whole quantity is sliced as one batch: the CLI clones the model, arranges the copies and
spills onto further plates when they do not fit, so the quote reflects batch printing (about 18% less machine
time for 10 Benchys than 10 single prints). Slicing takes roughly one second per copy.
Pricing inputs live in the backend `application.yml` under `quote.*`.

```powershell
curl.exe -F "file=@public/3DBenchy.stl" -F "filament=PETG" -F "quality=high" -F "quantity=2" http://localhost:8080/api/quotes
```

## Notes
- Backend code is mounted as a volume and is not modified by this setup.
- This is a local dev stack. Production should use dedicated images, secrets, and non-default credentials.
- Spring datasource env is overridden to use Docker service names instead of localhost.
- `xvfb-run` is intentionally omitted because the backend feasibility note in the slicer repo already verified headless slicing without an X server.
- The backend still owns slicing orchestration. The CLI now lives in the same container because the Java service launches a local process.
