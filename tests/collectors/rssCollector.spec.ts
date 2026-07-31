import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRssCollector, parseRssItems } from "../../src/collectors/rssCollector.js";

const fixturePath = fileURLToPath(new URL("../fixtures/rss-sample.xml", import.meta.url));
const fixtureXml = readFileSync(fixturePath, "utf-8");

describe("parseRssItems", () => {
  it("RSS 2.0のitem要素をNewsItem[]に変換する", () => {
    const items = parseRssItems(fixtureXml, "JSer.info");

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: "Sample Article One",
      url: "https://jser.info/2026/07/10/sample-one/",
      publishedAt: new Date("Fri, 10 Jul 2026 09:00:00 +0900"),
      source: "JSer.info",
      summary: "Summary of article one.",
    });
    expect(items[1]?.title).toBe("Sample Article Two");
  });

  it("item要素が1件のみの場合でも配列を返す", () => {
    const singleItemXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Only Article</title>
      <link>https://example.com/only</link>
      <pubDate>Fri, 10 Jul 2026 09:00:00 +0900</pubDate>
    </item>
  </channel>
</rss>`;

    const items = parseRssItems(singleItemXml, "TestFeed");

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Only Article");
  });
});

describe("createRssCollector", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchでフィードURLを取得し、NewsItem[]を返す", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureXml,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const collector = createRssCollector({ name: "JSer.info", url: "https://jser.info/rss/" });
    const items = await collector.fetch();

    expect(fetchMock).toHaveBeenCalledWith("https://jser.info/rss/");
    expect(collector.name).toBe("JSer.info");
    expect(items).toHaveLength(2);
  });

  it("レスポンスが失敗ステータスの場合はエラーを投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, text: async () => "" })),
    );

    const collector = createRssCollector({ name: "Broken", url: "https://example.com/broken.xml" });

    await expect(collector.fetch()).rejects.toThrow();
  });
});
