import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendErrorLog, buildErrorLogPath } from "../../src/core/errorLog.js";

describe("buildErrorLogPath", () => {
  it("YYYY-MM-DD.json 形式のパスを組み立てる", () => {
    const path = buildErrorLogPath(new Date("2026-07-05T00:00:00Z"), "logs/errors");
    expect(path).toBe(join("logs/errors", "2026-07-05.json"));
  });
});

describe("appendErrorLog", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "qiita-digest-errors-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("ファイルが存在しない場合は新規作成し、日時付きで1件目を書き込む", async () => {
    const path = join(dir, "2026-07-05.json");

    await appendErrorLog(path, { phase: "collect", errorType: "collector_fetch_failed", message: "network error" });

    const raw = await readFile(path, "utf-8");
    const entries = JSON.parse(raw);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      phase: "collect",
      errorType: "collector_fetch_failed",
      message: "network error",
    });
    expect(typeof entries[0].timestamp).toBe("string");
  });

  it("既存ファイルがある場合は配列に追記する", async () => {
    const path = join(dir, "2026-07-05.json");

    await appendErrorLog(path, { phase: "collect", errorType: "collector_fetch_failed", message: "first" });
    await appendErrorLog(path, { phase: "publish", errorType: "qiita_post_failed", message: "second" });

    const raw = await readFile(path, "utf-8");
    const entries = JSON.parse(raw);
    expect(entries).toHaveLength(2);
    expect(entries[1].message).toBe("second");
  });
});
