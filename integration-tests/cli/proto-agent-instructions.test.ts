/**
 * Verifies the canonical agent-instructions file layout:
 *   - PROTO.md exists at repo root with required sections
 *   - AGENTS.md is a thin pointer (≤5 lines) referencing PROTO.md
 *   - CLAUDE.md is a thin pointer referencing PROTO.md
 *   - .gitignore does not ignore PROTO.md, AGENTS.md, or CLAUDE.md
 */

import { describe, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

function readRelative(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

describe("proto agent-instructions files", () => {
  it("PROTO.md exists at repo root", () => {
    const exists = fs.existsSync(path.join(REPO_ROOT, "PROTO.md"));
    if (!exists) {
      throw new Error("PROTO.md must exist at the repository root");
    }
  });

  it("PROTO.md contains all required sections", () => {
    const content = readRelative("PROTO.md");
    const requiredSections = [
      "## Project Overview",
      "## Technology Stack",
      "## Building and Running",
      "## Conventions",
      "## Shared Dependencies",
      "## Do and Don't",
    ];
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        throw new Error(`PROTO.md is missing required section: ${section}`);
      }
    }
  });

  it("AGENTS.md is a thin pointer (≤5 lines) referencing PROTO.md", () => {
    const content = readRelative("AGENTS.md");
    const lines = content
      .split("\n")
      .filter((line) => line.trim().length > 0);
    if (lines.length > 5) {
      throw new Error(
        `AGENTS.md has ${lines.length} non-empty lines; must be ≤5. It should be a thin pointer to PROTO.md.`,
      );
    }
    if (!content.toLowerCase().includes("proto.md")) {
      throw new Error("AGENTS.md must reference PROTO.md");
    }
  });

  it("CLAUDE.md is a thin pointer referencing PROTO.md", () => {
    const content = readRelative("CLAUDE.md");
    const lines = content
      .split("\n")
      .filter((line) => line.trim().length > 0);
    if (lines.length > 5) {
      throw new Error(
        `CLAUDE.md has ${lines.length} non-empty lines; must be ≤5. It should be a thin pointer to PROTO.md.`,
      );
    }
    if (!content.toLowerCase().includes("proto.md")) {
      throw new Error("CLAUDE.md must reference PROTO.md");
    }
  });

  it(".gitignore does not ignore PROTO.md, AGENTS.md, or CLAUDE.md", () => {
    const gitignore = readRelative(".gitignore");
    const files = ["PROTO.md", "AGENTS.md", "CLAUDE.md"];
    for (const file of files) {
      const lines = gitignore.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === file || trimmed === `!${file}`) {
          throw new Error(
            `.gitignore must not contain an entry for ${file}`,
          );
        }
      }
    }
  });

  it(".gitignore uses **/node_modules for recursive coverage", () => {
    const gitignore = readRelative(".gitignore");
    if (!gitignore.includes("**/node_modules")) {
      throw new Error(
        ".gitignore must contain '**/node_modules' to recursively ignore all node_modules directories",
      );
    }
  });

  it(".gitignore un-ignores root package-lock.json for npm ci", () => {
    const gitignore = readRelative(".gitignore");
    const lines = gitignore.split("\n");
    const hasUnignore = lines.some(
      (line) => line.trim() === "!package-lock.json",
    );
    if (!hasUnignore) {
      throw new Error(
        ".gitignore must un-ignore root package-lock.json (with '!package-lock.json') so npm ci can read it",
      );
    }
  });
});
