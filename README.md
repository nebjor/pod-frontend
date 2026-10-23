# pod-frontend

The 3DBurg shop frontend: Angular 21 with server-side rendering. Customers upload an STL or
3MF, get a sliced quote from the backend, order and pay; the owner handles orders in `/admin`.

| Folder | Purpose |
|---|---|
| `src/`, `public/`, `e2e/` | The Angular application, its unit tests and the visual smoke test |
| `docker-compose.local.yml`, `docker/` | Local development stack with the backend and PostgreSQL (see `README.local-docker.md`) |
| `deploy/` | Production stack for one server: Caddy with HTTPS, frontend, backend, PostgreSQL; `.env.example`, backup script and the runbook |

The backend lives in [cad-slicer-engine](https://github.com/nebjor/cad-slicer-engine); its
roadmap and architecture notes cover the whole shop.

## Development

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.27.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
