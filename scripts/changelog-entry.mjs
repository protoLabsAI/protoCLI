#!/usr/bin/env node
// Prepend a release entry to the marketing changelog (sites/marketing/data/changelog.json).
//
// Usage: node scripts/changelog-entry.mjs <version> [previousVersion]
//
// release-tools (@protolabsai/release-tools) produces the polished GitHub
// release + Discord notes; this keeps the marketing changelog in sync from the
// same git history so the site never drifts. Bullets are the user-facing
// feat/fix/perf commit subjects between the two tags. Idempotent: re-running for
// an existing version replaces that entry. Wire it into release.yml after notes
// are generated, or run it by hand.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const version = process.argv[2];
if (!version) {
  console.error("usage: changelog-entry.mjs <version> [previousVersion]");
  process.exit(1);
}

const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

let prev = process.argv[3] || "";
if (!prev) {
  try {
    prev = sh(`git describe --tags --abbrev=0 "${version}^"`);
  } catch {
    prev = "";
  }
}

const range = prev ? `${prev}..${version}` : version;
let subjects = [];
try {
  subjects = sh(`git log ${range} --no-merges --pretty=format:%s`)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
} catch (e) {
  console.error("git log failed:", e.message);
}

// Keep user-facing feat/fix/perf; drop chore/docs/test/ci/release noise. Strip
// the conventional-commit prefix and trailing (#PR).
const changes = [
  ...new Set(
    subjects
      .filter((s) => /^(feat|fix|perf)(\(|:|!)/.test(s))
      .map((s) =>
        s
          .replace(/^(feat|fix|perf)(\([^)]*\))?!?:\s*/, "")
          .replace(/\s*\(#\d+\)\s*$/, "")
          .trim(),
      )
      .filter(Boolean),
  ),
];

if (changes.length === 0) changes.push("Maintenance and internal improvements.");

const date = process.env.RELEASE_DATE || new Date().toISOString().slice(0, 10);
const tag = version.startsWith("v") ? version : `v${version}`;

const file = new URL(
  "../sites/marketing/data/changelog.json",
  import.meta.url,
);
const list = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : [];
const entry = { version: tag, date, changes };
const next = [entry, ...list.filter((e) => e.version !== tag)];
writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
console.log(`changelog: ${tag} — ${changes.length} change(s) [${range}]`);
