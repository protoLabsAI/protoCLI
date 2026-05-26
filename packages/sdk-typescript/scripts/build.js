/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import { rmSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

rmSync(join(rootDir, 'dist'), { recursive: true, force: true });
mkdirSync(join(rootDir, 'dist'), { recursive: true });

execSync('tsc --project tsconfig.build.json', {
  stdio: 'inherit',
  cwd: rootDir,
});

try {
  // Bundle main entry's type definitions
  execSync(
    'npx dts-bundle-generator --project tsconfig.build.json -o dist/index.d.ts src/index.ts',
    {
      stdio: 'inherit',
      cwd: rootDir,
    },
  );

  // Bundle anthropic-compat subpath type definitions. Separate bundle so
  // consumers using only the main entry don't pay for the compat surface,
  // and the compat .d.ts can be imported via the `./anthropic-compat` export
  // path without leaking proto's internal type layout.
  // Hand-rolled .d.ts for anthropic-compat. dts-bundle-generator transitively
  // pulls in proto's `types/types.ts` whenever the compat module references
  // any proto type (even via `Parameters<typeof protoQuery>` indirection),
  // and that file declares `HookCallback` / `HookCallbackResult` / `CanUseTool`
  // under the same names this compat module exports under — yielding
  // duplicate-export errors in the generated bundle. Maintaining a small
  // hand-rolled .d.ts sidesteps the issue entirely and keeps the public
  // surface tight (only the types consumers actually need from the compat
  // import path are visible).
  const compatDtsSource = join(
    rootDir,
    'src',
    'anthropic-compat.d.ts.template',
  );
  const compatDtsTarget = join(rootDir, 'dist', 'anthropic-compat.d.ts');
  if (existsSync(compatDtsSource)) {
    cpSync(compatDtsSource, compatDtsTarget);
  } else {
    console.warn(
      `anthropic-compat: template file ${compatDtsSource} not found; ` +
        'consumers importing types from @protolabsai/sdk/anthropic-compat will fail.',
    );
  }

  const dirsToRemove = ['mcp', 'query', 'transport', 'types', 'utils'];
  for (const dir of dirsToRemove) {
    const dirPath = join(rootDir, 'dist', dir);
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }
} catch (error) {
  console.warn(
    'Could not bundle type definitions, keeping separate .d.ts files',
    error.message,
  );
}

await esbuild.build({
  entryPoints: [join(rootDir, 'src', 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile: join(rootDir, 'dist', 'index.mjs'),
  external: ['@modelcontextprotocol/sdk'],
  sourcemap: false,
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  legalComments: 'none',
  keepNames: false,
  treeShaking: true,
});

await esbuild.build({
  entryPoints: [join(rootDir, 'src', 'index.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: join(rootDir, 'dist', 'index.cjs'),
  external: ['@modelcontextprotocol/sdk'],
  sourcemap: false,
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  legalComments: 'none',
  keepNames: false,
  treeShaking: true,
});

// Anthropic-compat subpath bundles. Same esbuild config as the main entry —
// the compat module is small and re-exports most of the proto SDK surface, so
// tree-shaking keeps the bundle reasonable.
await esbuild.build({
  entryPoints: [join(rootDir, 'src', 'anthropic-compat.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile: join(rootDir, 'dist', 'anthropic-compat.mjs'),
  external: ['@modelcontextprotocol/sdk'],
  sourcemap: false,
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  legalComments: 'none',
  keepNames: false,
  treeShaking: true,
});

await esbuild.build({
  entryPoints: [join(rootDir, 'src', 'anthropic-compat.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: join(rootDir, 'dist', 'anthropic-compat.cjs'),
  external: ['@modelcontextprotocol/sdk'],
  sourcemap: false,
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  legalComments: 'none',
  keepNames: false,
  treeShaking: true,
});

// Copy LICENSE from root directory to dist
const licenseSource = join(rootDir, '..', '..', 'LICENSE');
const licenseTarget = join(rootDir, 'dist', 'LICENSE');
if (existsSync(licenseSource)) {
  try {
    cpSync(licenseSource, licenseTarget);
  } catch (error) {
    console.warn('Could not copy LICENSE:', error.message);
  }
}
