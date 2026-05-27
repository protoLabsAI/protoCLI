/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

// Unset NO_COLOR environment variable to ensure consistent theme behavior between local and CI test runs
if (process.env['NO_COLOR'] !== undefined) {
  delete process.env['NO_COLOR'];
}

import {
  mkdir,
  readdir,
  rm,
  readFile,
  writeFile,
  unlink,
} from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as os from 'node:os';

import {
  QWEN_CONFIG_DIR,
  DEFAULT_CONTEXT_FILENAME,
} from '../packages/core/src/tools/memoryTool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const integrationTestsDir = join(rootDir, '.integration-tests');
let runDir = ''; // Make runDir accessible in teardown
let sdkE2eRunDir = ''; // SDK E2E test run directory

const memoryFilePath = join(
  os.homedir(),
  QWEN_CONFIG_DIR,
  DEFAULT_CONTEXT_FILENAME,
);
let originalMemoryContent: string | null = null;

export async function setup() {
  try {
    originalMemoryContent = await readFile(memoryFilePath, 'utf-8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
    // File doesn't exist, which is fine.
  }

  // Setup for CLI integration tests
  runDir = join(integrationTestsDir, `${Date.now()}`);
  await mkdir(runDir, { recursive: true });

  // Setup for SDK E2E tests (separate directory with prefix)
  sdkE2eRunDir = join(integrationTestsDir, `sdk-e2e-${Date.now()}`);
  await mkdir(sdkE2eRunDir, { recursive: true });

  // Clean up old test runs, but keep the latest few for debugging
  try {
    const testRuns = await readdir(integrationTestsDir);

    // Clean up old CLI integration test runs (without sdk-e2e- prefix)
    const cliTestRuns = testRuns.filter((run) => !run.startsWith('sdk-e2e-'));
    if (cliTestRuns.length > 5) {
      const oldRuns = cliTestRuns.sort().slice(0, cliTestRuns.length - 5);
      await Promise.all(
        oldRuns.map((oldRun) =>
          rm(join(integrationTestsDir, oldRun), {
            recursive: true,
            force: true,
          }),
        ),
      );
    }

    // Clean up old SDK E2E test runs (with sdk-e2e- prefix)
    const sdkTestRuns = testRuns.filter((run) => run.startsWith('sdk-e2e-'));
    if (sdkTestRuns.length > 5) {
      const oldRuns = sdkTestRuns.sort().slice(0, sdkTestRuns.length - 5);
      await Promise.all(
        oldRuns.map((oldRun) =>
          rm(join(integrationTestsDir, oldRun), {
            recursive: true,
            force: true,
          }),
        ),
      );
    }
  } catch (e) {
    console.error('Error cleaning up old test runs:', e);
  }

  // Environment variables for CLI integration tests
  process.env['INTEGRATION_TEST_FILE_DIR'] = runDir;
  process.env['QWEN_CODE_INTEGRATION_TEST'] = 'true';
  process.env['TELEMETRY_LOG_FILE'] = join(runDir, 'telemetry.log');

  // Environment variables for SDK E2E tests
  process.env['E2E_TEST_FILE_DIR'] = sdkE2eRunDir;
  process.env['TEST_CLI_PATH'] = join(rootDir, 'dist/cli.js');

  if (process.env['KEEP_OUTPUT']) {
    console.log(`Keeping output for test run in: ${runDir}`);
    console.log(`Keeping output for SDK E2E test run in: ${sdkE2eRunDir}`);
  }
  process.env['VERBOSE'] = process.env['VERBOSE'] ?? 'false';

  console.log(`\nIntegration test output directory: ${runDir}`);
  console.log(`SDK E2E test output directory: ${sdkE2eRunDir}`);
  console.log(`CLI path: ${process.env['TEST_CLI_PATH']}`);

  await authPreflight();
}

/**
 * Fail fast on a bad gateway credential.
 *
 * The model-driving E2E tests each spawn the CLI, which aborts on a failed
 * auth preflight (HTTP 401) with exit code 1. When the gateway key is expired
 * or revoked, that surfaces as ~200 opaque "CLI process exited with code 1"
 * assertion failures across the suite — a 25-minute red run with no obvious
 * cause (see protoCLI#226). Probing `/models` once here turns that into a
 * single clear message and aborts the whole suite immediately.
 *
 * Only runs when OpenAI-compatible creds are present; a missing key is left
 * to the individual tests (some auth paths don't use these env vars). A
 * network error is treated as transient and does not block the run — only an
 * explicit 401/403 (credential rejection) fails the suite.
 */
async function authPreflight(): Promise<void> {
  const baseUrl = process.env['OPENAI_BASE_URL'];
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!baseUrl || !apiKey) return;

  const modelsUrl = `${baseUrl.replace(/\/$/, '')}/models`;
  let status: number | undefined;
  try {
    const res = await fetch(modelsUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
  } catch (err) {
    // Network error / timeout — don't block the run on transient infra.
    console.warn(
      `Auth preflight skipped (network error reaching ${modelsUrl}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return;
  }

  if (status === 401 || status === 403) {
    throw new Error(
      `E2E auth preflight failed: HTTP ${status} from ${modelsUrl}.\n` +
        `The gateway credential (OPENAI_API_KEY / OPENAI_BASE_URL) is invalid, ` +
        `expired, or revoked. Rotate the repo secret before re-running — every ` +
        `model-driving test will otherwise fail with "CLI process exited with code 1". ` +
        `See protoCLI#226.`,
    );
  }
}

export async function teardown() {
  // Cleanup the CLI test run directory unless KEEP_OUTPUT is set
  if (process.env['KEEP_OUTPUT'] !== 'true' && runDir) {
    await rm(runDir, { recursive: true, force: true });
  }

  // Cleanup the SDK E2E test run directory unless KEEP_OUTPUT is set
  if (process.env['KEEP_OUTPUT'] !== 'true' && sdkE2eRunDir) {
    await rm(sdkE2eRunDir, { recursive: true, force: true });
  }

  if (originalMemoryContent !== null) {
    await mkdir(dirname(memoryFilePath), { recursive: true });
    await writeFile(memoryFilePath, originalMemoryContent, 'utf-8');
  } else {
    try {
      await unlink(memoryFilePath);
    } catch {
      // File might not exist if the test failed before creating it.
    }
  }
}
