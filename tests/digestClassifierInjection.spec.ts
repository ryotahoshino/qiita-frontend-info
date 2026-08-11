// specs/004-llm-classification/tasks.md T013
// digest.ts が Classifier の実装(Keyword/Anthropic)を意識しないことを、モックの Classifier で検証する。
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Collector, NewsItem } from "../src/collectors/types.js";
import type { Classifier } from "../src/core/classifier.js";
import type { Classification, Topic } from "../src/core/topicMatcher.js";
import type { StateFile } from "../src/core/state.js";
import { runDigest, type DigestDeps } from "../src/digest.js";

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

function makeMockClassifier(result: Classification[]): Classifier {
  return {
    name: "mock",
    classify: vi.fn(async () => result),
  };
}

const TOPICS: Topic[] = [{ name: "React", priority: "high", keywords: ["react"] }];

function makeDeps(overrides: Partial<DigestDeps> = {}): DigestDeps {
  return {
    collectors: [],
    today: new Date("2026-07-15T00:00:00Z"),
    qiitaToken: "dummy-token",
    topics: TOPICS,
    topicsMarkdown: "",
    classifier: makeMockClassifier([]),
    loadState: vi.fn(async (): Promise<StateFile | null> => ({ seenUrls: [] })),
    saveState: vi.fn(async () => {}),
    readArticleFile: vi.fn(async (): Promise<string | null> => null),
    writeArticleFile: vi.fn(async () => {}),
    renderArticles: vi.fn((sections) => JSON.stringify(sections)),
    appendArticles: vi.fn((existing, sections) => existing + JSON.stringify(sections)),
    postToQiita: vi.fn(async () => {}),
    logError: vi.fn(async () => {}),
    logSkipped: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("digest.ts と Classifier注入(実装非依存)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("T013: 注入されたClassifierの分類結果をそのまま使ってarticles/・state.json・skippedログに反映する", async () => {
    const matched = makeItem({ title: "React記事", url: "https://example.com/react" });
    const skipped = makeItem({ title: "無関係記事", url: "https://example.com/unrelated" });
    const classifier = makeMockClassifier([
      { topic: "React", relevance: "high" },
      { topic: "", relevance: "skip" },
    ]);
    const deps = makeDeps({
      collectors: [makeCollector("feed1", [matched, skipped])],
      classifier,
      topicsMarkdown: "# TOPICS.md",
    });

    const result = await runDigest(deps);

    // classifierが正しい引数(新規記事、topics、topicsMarkdown)で1回呼ばれる
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    expect(classifier.classify).toHaveBeenCalledWith([matched, skipped], TOPICS, "# TOPICS.md");

    // 分類結果通りarticles/にはmatchedのみ反映される
    expect(deps.writeArticleFile).toHaveBeenCalledTimes(1);
    const [content] = vi.mocked(deps.writeArticleFile).mock.calls[0]!;
    expect(content).toContain("React記事");
    expect(content).not.toContain("無関係記事");

    // state.jsonには両方のURLが記録される
    const [savedState] = vi.mocked(deps.saveState).mock.calls[0]!;
    expect(savedState.seenUrls).toEqual(
      expect.arrayContaining([matched.url, skipped.url]),
    );

    // skip記事はskippedログに記録される
    expect(deps.logSkipped).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.logSkipped).mock.calls[0]![0]).toMatchObject({ url: skipped.url });

    expect(result.exitCode).toBe(0);
  });

  it("T013: Classifierの実装名(name)によってdigest.tsの挙動は変わらない", async () => {
    const item = makeItem({ title: "React記事", url: "https://example.com/react" });
    const keywordLike = makeMockClassifier([{ topic: "React", relevance: "high" }]);
    keywordLike.name = "keyword";
    const llmLike = makeMockClassifier([{ topic: "React", relevance: "high" }]);
    llmLike.name = "anthropic";

    const depsKeyword = makeDeps({ collectors: [makeCollector("feed1", [item])], classifier: keywordLike });
    const depsLlm = makeDeps({ collectors: [makeCollector("feed1", [item])], classifier: llmLike });

    await runDigest(depsKeyword);
    await runDigest(depsLlm);

    const [keywordContent] = vi.mocked(depsKeyword.writeArticleFile).mock.calls[0]!;
    const [llmContent] = vi.mocked(depsLlm.writeArticleFile).mock.calls[0]!;
    expect(keywordContent).toEqual(llmContent);
  });
});
