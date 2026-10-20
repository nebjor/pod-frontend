// Generates src/app/api/openapi.d.ts from the backend's OpenAPI document.
//
//   npm run api:types                 (backend on http://localhost:8080)
//   BACKEND_URL=https://3dburg.ch npm run api:types
//
// The output is committed, so the frontend compiles without a running backend and a change
// in the contract shows up as a reviewable diff. Run it after every backend DTO change.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';

const backendUrl = (process.env['BACKEND_URL'] ?? 'http://localhost:8080').replace(/\/$/, '');
const specUrl = new URL(`${backendUrl}/v3/api-docs`);
const outputPath = resolve('src/app/api/openapi.d.ts');

const ast = await openapiTS(specUrl, {
    // Spring does not mark response fields as required; treat them as present unless nullable.
    propertiesRequiredByDefault: true,
    alphabetize: true
});

const header = `/**
 * Generated from ${specUrl.pathname} of the cad-slicer-engine backend by scripts/generate-api-types.mjs.
 * Do not edit by hand; run \`npm run api:types\` against a running backend instead.
 */
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, header + astToString(ast));
console.log(`API types written to ${outputPath}`);
