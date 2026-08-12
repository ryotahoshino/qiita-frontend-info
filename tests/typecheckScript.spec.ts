// specs/005-pr-trigger-ci/tasks.md T001
// package.json に typecheck スクリプトが定義されていることを検証する。
// 実装(package.json への追記)前は失敗する。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

describe("package.json の typecheck スクリプト", () => {
  it("scripts.typecheck が tsc --noEmit -p tsconfig.json である", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.typecheck).toBe("tsc --noEmit -p tsconfig.json");
  });
});
