// Starts the SSR build of dist/ plus a front proxy: /api/* goes to the mock API, everything
// else to the SSR server. Nothing is built here; run `npm run build` first.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMockServer } from './mock-api.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = resolve(root, 'dist/pod-frontend/server/server.mjs');

export const PORTS = {
    front: Number(process.env.E2E_PORT ?? 4310),
    ssr: Number(process.env.E2E_SSR_PORT ?? 4311),
    mock: Number(process.env.E2E_MOCK_PORT ?? 4312)
};

function proxy(target) {
    return (req, res) => {
        const upstream = http.request(
            { host: '127.0.0.1', port: target, path: req.url, method: req.method, headers: req.headers },
            (up) => {
                res.writeHead(up.statusCode ?? 502, up.headers);
                up.pipe(res);
            }
        );
        upstream.on('error', () => {
            res.writeHead(502).end('bad gateway');
        });
        req.pipe(upstream);
    };
}

/** Starts mock, SSR and front proxy; resolves with a `stop` function. */
export async function startStack() {
    if (!existsSync(serverEntry)) {
        throw new Error(`${serverEntry} is missing; run "npm run build" first`);
    }
    const mock = createMockServer();
    await new Promise((done) => mock.listen(PORTS.mock, '127.0.0.1', done));

    const ssr = spawn(process.execPath, [serverEntry], {
        cwd: root,
        env: { ...process.env, PORT: String(PORTS.ssr) },
        stdio: ['ignore', 'inherit', 'inherit']
    });
    const toApi = proxy(PORTS.mock);
    const toSsr = proxy(PORTS.ssr);
    const front = http.createServer((req, res) => (req.url.startsWith('/api/') ? toApi(req, res) : toSsr(req, res)));
    await new Promise((done) => front.listen(PORTS.front, '127.0.0.1', done));

    for (let attempt = 0; ; attempt++) {
        const ready = await fetch(`http://127.0.0.1:${PORTS.ssr}/`).then(
            (r) => r.ok,
            () => false
        );
        if (ready) break;
        if (attempt >= 100) throw new Error('SSR server did not start');
        await new Promise((r) => setTimeout(r, 300));
    }

    return () => {
        ssr.kill();
        front.close();
        mock.close();
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await startStack();
    console.log(`e2e stack on http://127.0.0.1:${PORTS.front}`);
}
