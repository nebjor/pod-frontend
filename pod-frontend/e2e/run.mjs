// `npm run e2e:smoke`: builds when dist/ is missing, starts mock + SSR + proxy, runs the
// Playwright smoke and shuts everything down, also when the run fails.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTS, startStack } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = { cwd: root, stdio: 'inherit' };
const ng = resolve(root, 'node_modules/@angular/cli/bin/ng.js');
const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');

// The mock and the proxy live in this process, so the test run must not block the event loop.
const runAsync = (args) =>
    new Promise((done) => spawn(process.execPath, [playwright, ...args], options).on('exit', (code) => done(code ?? 1)));

if (!existsSync(resolve(root, 'dist/pod-frontend/server/server.mjs'))) {
    console.log('dist/ is missing, building first');
    if (spawnSync(process.execPath, [ng, 'build'], options).status !== 0) process.exit(1);
}

const stop = await startStack();
let status = 1;
try {
    process.env.E2E_BASE_URL = `http://127.0.0.1:${PORTS.front}`;
    process.env.E2E_MOCK_URL = `http://127.0.0.1:${PORTS.mock}`;
    status = await runAsync(['test', 'e2e/smoke.spec.mjs', ...process.argv.slice(2)]);
} finally {
    stop();
}
process.exit(status);
