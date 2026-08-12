// specs/005-pr-trigger-ci/tasks.md T003
// ci.yml がシークレットを一切参照しないことを検証する(research.md #2)。
// ci.yml は未実装のため、現時点では失敗する。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ciYmlPath = fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url));

describe("ci.yml のシークレット不参照", () => {
  it("secrets. を参照する箇所が存在しない", () => {
    const content = readFileSync(ciYmlPath, "utf-8");
    expect(content).not.toContain("secrets.");
  });
});
