import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  it("config.yaml.example相当のYAMLをパースできる", () => {
    const yaml = `
feeds:
  - name: JSer.info
    url: https://jser.info/rss/
github_releases: []
qiita:
  private: true
  tags: [frontend, news]
llm:
  enabled: false
`;

    const config = parseConfig(yaml);

    expect(config.feeds).toEqual([{ name: "JSer.info", url: "https://jser.info/rss/" }]);
    expect(config.github_releases).toEqual([]);
    expect(config.qiita).toEqual({ private: true, tags: ["frontend", "news"] });
    expect(config.llm).toEqual({ enabled: false });
  });

  it("qiita.privateが未指定の場合はtrueをデフォルトにする(公開はコード側で変更しない)", () => {
    const config = parseConfig("feeds: []\n");

    expect(config.qiita.private).toBe(true);
  });

  it("qiita.privateを明示的にfalseにした場合はその値を尊重する(人間の明示的な設定変更)", () => {
    const config = parseConfig("qiita:\n  private: false\n");

    expect(config.qiita.private).toBe(false);
  });

  it("feedsが未指定の場合は空配列にする", () => {
    const config = parseConfig("qiita:\n  private: true\n");

    expect(config.feeds).toEqual([]);
  });
});
