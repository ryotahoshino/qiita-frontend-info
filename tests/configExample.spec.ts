// specs/002-scheduled-run/spec.md の [vitest] 受け入れ条件を落としたもの:
// Given: config.yaml.example の内容 / When: parseConfig でパースする
// Then: 例外を投げず、url を持つ feeds を1件以上含む Config を返す
//
// CI(.github/workflows/daily.yml)は config.yaml.example をそのまま config.yaml として
// 使うため、この内容が壊れると毎日の自動実行が起動できなくなる。そのための回帰テスト。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

const configExamplePath = fileURLToPath(new URL("../config.yaml.example", import.meta.url));
const configExampleYaml = readFileSync(configExamplePath, "utf-8");

describe("config.yaml.example のパース", () => {
  it("parseConfigで例外を投げず、urlを持つfeedsを1件以上含むConfigを返す", () => {
    const config = parseConfig(configExampleYaml);

    expect(config.feeds.length).toBeGreaterThan(0);
    for (const feed of config.feeds) {
      expect(typeof feed.url).toBe("string");
      expect(feed.url.length).toBeGreaterThan(0);
    }
  });
});
