// specs/004-llm-classification/tasks.md T001
// Classifier契約(contracts/classifier-interface.md)に対する KeywordClassifier のテスト。
// createKeywordClassifier は未実装のため、現時点では失敗する。
import { describe, expect, it } from "vitest";
import type { NewsItem } from "../../src/collectors/types.js";
import { classify, type Topic } from "../../src/core/topicMatcher.js";
import { createKeywordClassifier } from "../../src/core/topicMatcher.js";

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

describe("createKeywordClassifier", () => {
  it("nameプロパティを持つ", () => {
    const classifier = createKeywordClassifier();
    expect(typeof classifier.name).toBe("string");
    expect(classifier.name.length).toBeGreaterThan(0);
  });

  it("既存のclassify()と同じ結果を、items配列と同じ順序で返す", async () => {
    const items = [
      makeItem({ title: "React 19", url: "https://example.com/a" }),
      makeItem({ title: "TypeScript 5.9", url: "https://example.com/b" }),
      makeItem({ title: "全く関係のない話題", url: "https://example.com/c" }),
    ];
    const classifier = createKeywordClassifier();

    const result = await classifier.classify(items, TOPICS, "(未使用)");

    expect(result).toEqual(items.map((item) => classify(item, TOPICS)));
  });

  it("topicsMarkdown引数は無視する(結果に影響しない)", async () => {
    const items = [makeItem({ title: "React 19" })];
    const classifier = createKeywordClassifier();

    const withMarkdown = await classifier.classify(items, TOPICS, "# 何か別の内容");
    const withoutMarkdown = await classifier.classify(items, TOPICS, "");

    expect(withMarkdown).toEqual(withoutMarkdown);
  });

  it("空配列を渡すと空配列を返す", async () => {
    const classifier = createKeywordClassifier();
    const result = await classifier.classify([], TOPICS, "");
    expect(result).toEqual([]);
  });
});
