#!/usr/bin/env node
/**
 * Build the browser client bundle that DSH serves at /plugins/<id>/client.js.
 *
 * DSH's client-modules system requires the `./client` export to be a PREBUILT
 * artifact of the form:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *
 * It does not build sources for you. This script uses esbuild (a devDependency)
 * to produce `lib/client.js` (+ sourcemap) from `src/client/index.js`. Run:
 *   node scripts/build-client.mjs
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Platform seed words DSH's loader module table answers via the injected
// `require`. This bundle only needs the host context, so nothing is imported;
// the list is kept for symmetry with sibling plugins.
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
];

await build({
  entryPoints: [join(root, 'src/client/index.js')],
  outfile: join(root, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  external: PLATFORM_MODULES,
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'dsh-task-notify', factory: (require) => { var module = { exports: {} }; var exports = module.exports; Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });",
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
});