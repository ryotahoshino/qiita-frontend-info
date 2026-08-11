// specs/004-llm-classification/tasks.md T005〜T009
// contracts/anthropic-classify-contract.md に対する AnthropicClassifier のテスト。
// createAnthropicClassifier は未実装のため、現時点では失敗する。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewsItem } from "../../src/collectors/types.js";
import type { Topic } from "../../src/core/topicMatcher.js";
import { createAnthropicClassifier } from "../../src/core/anthropicClassifier.js";

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    title: "Sample Article",
    url: "https://example.com/sample",
    publishedAt: new Date("2026-07-15T00:00:00Z"),
    source: "TestFeed",
    ...overrides,
  };
}

const TOPICS: Topic[] = [
  { name: "React", priority: "high", keywords: ["react"] },
  { name: "TypeScript", priority: "medium", keywords: ["typescript"] },
];

function stubFetchJson(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function toolUseResponse(classifications: { topic: string; relevance: string }[]) {
  return {
    content: [
      {
        type: "tool_use",
        name: "classify_articles",
        input: { classifications },
      },
    ],
  };
}

function makeFallback(result: { topic: string; relevance: "high" | "medium" | "skip" }[]) {
  return {
    name: "fallback-stub",
    classify: vi.fn(async () => result),
  };
}

describe("createAnthropicClassifier", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // T005: 正常系。system=指示文のみ、記事データは<article>タグでuserメッセージに分離されている
  it("T005: systemには指示文のみ、記事データはarticleタグで区切ってuserメッセージに渡す", async () => {
    const items = [
      makeItem({ title: "React 19", summary: "新機能について", url: "https://example.com/a" }),
      makeItem({ title: "TypeScript 5.9", url: "https://example.com/b" }),
    ];
    const fetchMock = stubFetchJson(
      toolUseResponse([
        { topic: "React", relevance: "high" },
        { topic: "TypeScript", relevance: "medium" },
      ]),
    );
    const fallback = makeFallback([]);
    const logError = vi.fn(async () => {});
    const classifier = createAnthropicClassifier({ apiKey: "test-key", fallback, logError });

    const result = await classifier.classify(items, TOPICS, "# TOPICS.md本文");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse((init as RequestInit).body as string);

    // 記事本文(title/summary)がsystemに紛れ込んでいないこと
    expect(body.system).not.toContain("React 19");
    expect(body.system).not.toContain("新機能について");
    // TOPICS.md全文はsystem側にあること
    expect(body.system).toContain("TOPICS.md本文");

    // userメッセージにはarticleタグで区切られた記事データが含まれること
    const userContent = body.messages[0].content as string;
    expect(userContent).toContain("<article");
    expect(userContent).toContain("React 19");
    expect(userContent).toContain("TypeScript 5.9");

    expect(result).toEqual([
      { topic: "React", relevance: "high" },
      { topic: "TypeScript", relevance: "medium" },
    ]);
    expect(fallback.classify).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  // T006: API呼び出し自体が失敗 → fallbackに切り替え、errorType: "llm_classification_failed" で記録
  it("T006: API呼び出しが失敗した場合はfallbackし、llm_classification_failedを記録する", async () => {
    stubFetchJson({}, { ok: false, status: 500 });
    const fallbackResult = [{ topic: "React", relevance: "high" as const }];
    const fallback = makeFallback(fallbackResult);
    const logError = vi.fn(async () => {});
    const classifier = createAnthropicClassifier({ apiKey: "test-key", fallback, logError });
    const items = [makeItem()];

    const result = await classifier.classify(items, TOPICS, "");

    expect(result).toEqual(fallbackResult);
    expect(fallback.classify).toHaveBeenCalledWith(items, TOPICS, "");
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0]![0]).toMatchObject({ errorType: "llm_classification_failed" });
  });

  // T007: レスポンスがJSONとしてパースできない → fallback + 記録
  it("T007: 応答がJSONとしてパースできない場合はfallackし、llm_classification_failedを記録する", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const fallbackResult = [{ topic: "TypeScript", relevance: "medium" as const }];
    const fallback = makeFallback(fallbackResult);
    const logError = vi.fn(async () => {});
    const classifier = createAnthropicClassifier({ apiKey: "test-key", fallback, logError });
    const items = [makeItem()];

    const result = await classifier.classify(items, TOPICS, "");

    expect(result).toEqual(fallbackResult);
    expect(logError.mock.calls[0]![0]).toMatchObject({ errorType: "llm_classification_failed" });
  });

  // T008: スキーマ不一致(topic/relevanceフィールド欠落) → fallback + 記録
  it("T008: 応答がスキーマと一致しない場合はfallbackし、llm_classification_failedを記録する", async () => {
    stubFetchJson({
      content: [
        {
          type: "tool_use",
          name: "classify_articles",
          input: { classifications: [{ notTopic: "React" }] },
        },
      ],
    });
    const fallbackResult = [{ topic: "React", relevance: "high" as const }];
    const fallback = makeFallback(fallbackResult);
    const logError = vi.fn(async () => {});
    const classifier = createAnthropicClassifier({ apiKey: "test-key", fallback, logError });
    const items = [makeItem()];

    const result = await classifier.classify(items, TOPICS, "");

    expect(result).toEqual(fallbackResult);
    expect(logError.mock.calls[0]![0]).toMatchObject({ errorType: "llm_classification_failed" });
  });

  // T009: スキーマは妥当だがtopicsに存在しないtopic名 → その記事のみskip、fallbackはしない
  it("T009: topicsに無いtopic名は当該記事のみskipにし、fallbackはしない", async () => {
    stubFetchJson(
      toolUseResponse([
        { topic: "React", relevance: "high" },
        { topic: "存在しないトピック", relevance: "high" },
      ]),
    );
    const fallback = makeFallback([]);
    const logError = vi.fn(async () => {});
    const classifier = createAnthropicClassifier({ apiKey: "test-key", fallback, logError });
    const items = [
      makeItem({ title: "React記事", url: "https://example.com/a" }),
      makeItem({ title: "不明記事", url: "https://example.com/b" }),
    ];

    const result = await classifier.classify(items, TOPICS, "");

    expect(result).toEqual([
      { topic: "React", relevance: "high" },
      { topic: "", relevance: "skip" },
    ]);
    expect(fallback.classify).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });
});
