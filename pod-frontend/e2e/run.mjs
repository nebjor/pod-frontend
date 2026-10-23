// `npm run e2e:smoke`: builds when dist/ is missing or older than the sources, starts
// mock + SSR + proxy, runs the Playwright smoke and shuts everything down, also when the run
// fails or is interrupted. `E2E_SKIP_BUILD=1` never builds.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTS, startStack } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = { cwd: root, stdio: 'inherit' };
const ng = resolve(root, 'node_modules/@angular/cli/bin/ng.js');
const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');
const serverEntry = resolve(root, 'dist/pod-frontend/server/server.mjs');

// The mock and the proxy live in this process, so the test run must not block the event loop.
const runAsync = (args) =>
    new Promise((done) => spawn(process.execPath, [playwright, ...args], options).on('exit', (code) => done(code ?? 1)));

/** Newest modification time below a file or directory. */
function newestMtime(path) {
    if (!existsSync(path)) return 0;
    const stat = statSync(path);
    if (!stat.isDirectory()) return stat.mtimeMs;
    return readdirSync(path).reduce((newest, name) => Math.max(newest, newestMtime(join(path, name))), 0);
}

function buildIfNeeded() {
    if (process.env.E2E_SKIP_BUILD) {
        console.log('E2E_SKIP_BUILD is set: using dist/ as it is');
        return;
    }
    let reason = null;
    if (!existsSync(serverEntry)) {
        reason = 'dist/ is missing';
    } else {
        const builtAt = statSync(serverEntry).mtimeMs;
        const changed = ['src', 'public', 'angular.json'].find((path) => newestMtime(resolve(root, path)) > builtAt);
        if (changed) reason = `${changed} is newer than the build`;
    }
    if (!reason) {
        console.log('dist/ is up to date, not building');
        return;
    }
    console.log(`Building: ${reason}`);
    if (spawnSync(process.execPath, [ng, 'build'], options).status !== 0) throw new Error('build failed');
}

let stop = () => {};
const shutdown = (code) => {
    stop();
    process.exit(code);
};
process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

let status = 1;
try {
    buildIfNeeded();
    stop = await startStack();
    process.env.E2E_BASE_URL = `http://127.0.0.1:${PORTS.front}`;
    process.env.E2E_MOCK_URL = `http://127.0.0.1:${PORTS.mock}`;
    status = await runAsync(['test', 'e2e/smoke.spec.mjs', ...process.argv.slice(2)]);
} catch (error) {
    console.error(error);
} finally {
    stop();
}
process.exit(status);
