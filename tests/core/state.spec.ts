import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadState, saveState } from "../../src/core/state.js";

let dir: string;
let statePath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qiita-digest-state-"));
  statePath = join(dir, "state.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadState / saveState", () => {
  it("ファイルが存在しない場合はnullを返す", async () => {
    const state = await loadState(statePath);
    expect(state).toBeNull();
  });

  it("saveStateで書き込んだ内容をloadStateで読み戻せる", async () => {
    await saveState(statePath, { seenUrls: ["https://example.com/a", "https://example.com/b"] });

    const state = await loadState(statePath);

    expect(state).toEqual({ seenUrls: ["https://example.com/a", "https://example.com/b"] });
  });
});
