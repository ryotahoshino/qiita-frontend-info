// specs/003-topics-filter/spec.md の受け入れ条件 AC7〜AC12 を vitest に落としたもの。
//
// 本specの実装では DigestDeps に `topics`(トピック定義)と `logSkipped`(skippedログ書き込み)を
// 追加し、`renderArticles`/`appendArticles` はフラットな NewsItem[] ではなく
// 「トピックごとにグループ化した配列(TopicSection[])」を受け取る形に変わる想定。
// 現時点では src/digest.ts にこの変更が入っていないため、以下のテストは
// (importエラーではなくアサーション不一致で)失敗する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Collector, NewsItem } from "../src/collectors/types.js";
import { createKeywordClassifier } from "../src/core/topicMatcher.js";
import { runDigest } from "../src/digest.js";

interface Topic {
  name: string;
  priority: "high" | "medium";
  keywords: string[];
}

interface TopicSection {
  topic: string;
  items: NewsItem[];
}

interface SkippedLogEntry {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

interface StateFile {
  seenUrls: string[];
}

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    title: "Sample Article",
    url: "https://example.com/sample",
    publishedAt: new Date("2026-07-15T00:00:00Z"),
    source: "TestFeed",
    ...overrides,
  };
}

function makeCollector(name: string, items: NewsItem[]): Collector {
  return { name, fetch: async () => items };
}

const REACT_TOPIC: Topic = { name: "React", priority: "high", keywords: ["react"] };
const TS_TOPIC: Topic = { name: "TypeScript", priority: "medium", keywords: ["typescript"] };

// DigestDeps は本spec実装時に拡張される想定のため、現行の型定義とは意図的に合わせていない。
function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    collectors: [] as Collector[],
    today: new Date("2026-07-15T00:00:00Z"),
    qiitaToken: "dummy-token",
    topics: [REACT_TOPIC, TS_TOPIC],
    topicsMarkdown: "",
    classifier: createKeywordClassifier(),
    loadState: vi.fn(async (): Promise<StateFile | null> => ({ seenUrls: [] })),
    saveState: vi.fn(async () => {}),
    readArticleFile: vi.fn(async (): Promise<string | null> => null),
    writeArticleFile: vi.fn(async () => {}),
    renderArticles: vi.fn((_sections: TopicSection[], _today: Date) => "rendered"),
    appendArticles: vi.fn((_existing: string, _sections: TopicSection[]) => "appended"),
    postToQiita: vi.fn(async () => {}),
    logError: vi.fn(async () => {}),
    logSkipped: vi.fn(async (_entry: SkippedLogEntry) => {}),
    ...overrides,
  };
}

describe("runDigest + TOPICS.mdフィルタ — specs/003-topics-filter/spec.md 受け入れ条件", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // AC7: Given: 新規記事3件のうち1件がどのトピックにも一致しない / When: digestを実行
  // Then: 一致した2件のみがarticles/に反映され、一致しなかった1件はlogs/skipped/YYYY-MM-DD.jsonに記録される
  it("AC7: トピックに一致しない記事はarticles/から除外され、skippedログに記録される", async () => {
    const reactItem = makeItem({ title: "React 19の新機能", url: "https://example.com/react19" });
    const tsItem = makeItem({ title: "TypeScript 5.9リリース", url: "https://example.com/ts59" });
    const unmatched = makeItem({ title: "全く関係のない話題", url: "https://example.com/unrelated" });
    const deps = makeDeps({ collectors: [makeCollector("feed1", [reactItem, tsItem, unmatched])] });

    await runDigest(deps as any);

    const sectionsArg = vi.mocked(deps.renderArticles).mock.calls[0]?.[0] as TopicSection[];
    const renderedUrls = sectionsArg.flatMap((s) => s.items.map((i) => i.url));
    expect(renderedUrls).toEqual(expect.arrayContaining([reactItem.url, tsItem.url]));
    expect(renderedUrls).not.toContain(unmatched.url);

    expect(deps.logSkipped).toHaveBeenCalledTimes(1);
    const skippedEntry = vi.mocked(deps.logSkipped).mock.calls[0]?.[0] as SkippedLogEntry;
    expect(skippedEntry.url).toBe(unmatched.url);
  });

  // AC8: Given: 新規記事がどのトピックにも一致せずskipされる / When: digestを実行
  // Then: そのURLはstate.jsonのseenUrlsに追加される
  it("AC8: skipされた記事のURLもstate.jsonのseenUrlsに追加される", async () => {
    const unmatched = makeItem({ title: "全く関係のない話題", url: "https://example.com/unrelated" });
    const deps = makeDeps({ collectors: [makeCollector("feed1", [unmatched])] });

    await runDigest(deps as any);

    expect(deps.saveState).toHaveBeenCalled();
    const savedState = vi.mocked(deps.saveState).mock.calls[0]?.[0] as StateFile;
    expect(savedState.seenUrls).toContain(unmatched.url);
  });

  // AC9: Given: 新規記事が複数トピックにまたがって分類される / When: digestを実行しarticles/を生成
  // Then: TOPICS.mdのトピック宣言順にセクション分けされ、各セクションにトピック名が含まれる
  it("AC9: トピック宣言順にセクション分けして描画関数に渡す", async () => {
    const reactItem1 = makeItem({ title: "React 19", url: "https://example.com/r1" });
    const reactItem2 = makeItem({ title: "React Compiler", url: "https://example.com/r2" });
    const tsItem = makeItem({ title: "TypeScript 5.9", url: "https://example.com/ts1" });
    // 取得順はTS→Reactでも、出力はTOPICS.md宣言順(React→TypeScript)になるはず
    const deps = makeDeps({ collectors: [makeCollector("feed1", [tsItem, reactItem1, reactItem2])] });

    await runDigest(deps as any);

    const sectionsArg = vi.mocked(deps.renderArticles).mock.calls[0]?.[0] as TopicSection[];
    expect(sectionsArg.map((s) => s.topic)).toEqual(["React", "TypeScript"]);
    expect(sectionsArg[0]?.items.map((i) => i.url)).toEqual([reactItem1.url, reactItem2.url]);
    expect(sectionsArg[1]?.items.map((i) => i.url)).toEqual([tsItem.url]);
  });

  // AC10: Given: 該当記事が0件のトピックがある / When: articles/を生成
  // Then: そのトピックのセクション見出しは出力されない
  it("AC10: 該当記事が無いトピックのセクションは生成しない", async () => {
    const tsItem = makeItem({ title: "TypeScript 5.9", url: "https://example.com/ts1" });
    const deps = makeDeps({ collectors: [makeCollector("feed1", [tsItem])] });

    await runDigest(deps as any);

    const sectionsArg = vi.mocked(deps.renderArticles).mock.calls[0]?.[0] as TopicSection[];
    expect(sectionsArg.map((s) => s.topic)).toEqual(["TypeScript"]);
    expect(sectionsArg.find((s) => s.topic === "React")).toBeUndefined();
  });

  // AC11: Given: dedupで新規と判定された記事が存在するが、全件がskip判定される / When: digestを実行
  // Then: articles/への書き込みは行われないが、全件のURLがstate.jsonに追加され、
  //       全件がlogs/skipped/YYYY-MM-DD.jsonに記録される。exit codeは0
  it("AC11: 全件skipの場合、articles/は書き込まないがstateとskippedログは更新する", async () => {
    const unmatched1 = makeItem({ title: "無関係1", url: "https://example.com/u1" });
    const unmatched2 = makeItem({ title: "無関係2", url: "https://example.com/u2" });
    const deps = makeDeps({ collectors: [makeCollector("feed1", [unmatched1, unmatched2])] });

    const result = await runDigest(deps as any);

    expect(deps.writeArticleFile).not.toHaveBeenCalled();
    expect(deps.saveState).toHaveBeenCalled();
    const savedState = vi.mocked(deps.saveState).mock.calls[0]?.[0] as StateFile;
    expect(savedState.seenUrls).toEqual(expect.arrayContaining([unmatched1.url, unmatched2.url]));
    expect(deps.logSkipped).toHaveBeenCalledTimes(2);
    expect(result.exitCode).toBe(0);
  });

  // AC12: Given: config.yamlのllm.enabledがfalse(デフォルト)または未設定 / When: digestを実行
  // Then: キーワードマッチのみで分類され、LLM API等の外部呼び出しは一切発生しない
  it("AC12: LLM関連の外部呼び出しは一切発生せず、キーワードマッチのみで分類が完結する", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const reactItem = makeItem({ title: "React 19", url: "https://example.com/react19" });
    // Collector.fetch はテスト用のモック関数であり globalThis.fetch は使わない
    const deps = makeDeps({ collectors: [makeCollector("feed1", [reactItem])] });

    await runDigest(deps as any);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
