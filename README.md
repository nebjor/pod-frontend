# pod-frontend

The 3DBurg shop frontend: Angular 21 with server-side rendering. Customers upload an STL or
3MF, get a sliced quote from the backend, order and pay; the owner handles orders in `/admin`.

| Folder | Purpose |
|---|---|
| `pod-frontend/` | The Angular application, its tests and the local Docker stack (`docker-compose.local.yml`, see `README.local-docker.md`) |
| `deploy/` | Production stack for one server: Caddy with HTTPS, frontend, backend, PostgreSQL; `.env.example`, backup script and the runbook |

The backend lives in [cad-slicer-engine](https://github.com/nebjor/cad-slicer-engine); its
roadmap and architecture notes cover the whole shop.
