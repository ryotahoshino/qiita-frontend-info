// specs/003-topics-filter/spec.md の受け入れ条件 AC1〜AC6 を vitest に落としたもの。
// src/core/topicMatcher.ts (parseTopics, classify) は未実装のため、現時点では全テストが失敗する。
import { describe, expect, it } from "vitest";
import type { NewsItem } from "../../src/collectors/types.js";
import { classify, parseTopics } from "../../src/core/topicMatcher.js";

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    title: "Sample Article",
    url: "https://example.com/sample",
    publishedAt: new Date("2026-07-15T00:00:00Z"),
    source: "TestFeed",
    ...overrides,
  };
}

const SAMPLE_TOPICS_MD = `# 収集トピック

## React
- priority: high
- keywords: react, rsc

## TypeScript
- priority: medium
- keywords: typescript, tsc

## 除外条件
- 単なる求人・イベント告知
`;

describe("parseTopics", () => {
  // AC3: Given: keywords: 行を持たない ## 除外条件 セクションを含むTOPICS.md / When: parseTopicsでパースする
  // Then: 除外条件はトピック一覧に含まれない
  it("AC3: keywords行を持たない見出しはトピック一覧に含めない", () => {
    const topics = parseTopics(SAMPLE_TOPICS_MD);

    expect(topics.map((t) => t.name)).toEqual(["React", "TypeScript"]);
    expect(topics.find((t) => t.name === "除外条件")).toBeUndefined();
  });

  // 補助テスト(spec外): 抽出したトピックのpriority/keywordsが正しいことを確認する
  it("各トピックのpriorityとkeywordsを抽出する", () => {
    const topics = parseTopics(SAMPLE_TOPICS_MD);

    expect(topics[0]).toEqual({ name: "React", priority: "high", keywords: ["react", "rsc"] });
    expect(topics[1]).toEqual({ name: "TypeScript", priority: "medium", keywords: ["typescript", "tsc"] });
  });
});

describe("classify", () => {
  const topics = parseTopics(SAMPLE_TOPICS_MD);

  // AC1: Given: keywords: react, rsc を持つ「React」トピック / When: タイトルに一致する記事をclassifyする
  // Then: 一致したトピック名とそのトピックのpriorityが返る
  it("AC1: タイトルがkeywordsに一致するとき、トピック名とpriorityを返す", () => {
    const item = makeItem({ title: "React Server Components入門" });

    expect(classify(item, topics)).toEqual({ topic: "React", relevance: "high" });
  });

  // AC2: Given: どのトピックのkeywordsにも一致しない記事 / When: classifyする / Then: skipが返る
  it("AC2: どのトピックにも一致しない場合はskipを返す", () => {
    const item = makeItem({ title: "全く関係のない話題です" });

    expect(classify(item, topics)).toEqual({ topic: "", relevance: "skip" });
  });

  // AC4: Given: タイトルには一致しないがsummaryに一致するキーワードがある記事 / When: classifyする
  // Then: summaryも判定対象となり、一致したトピックが返る
  it("AC4: タイトルに一致しなくてもsummaryに一致すれば分類される", () => {
    const item = makeItem({
      title: "今週のフロントエンドニュース",
      summary: "TypeScriptの新機能について解説",
    });

    expect(classify(item, topics)).toEqual({ topic: "TypeScript", relevance: "medium" });
  });

  // AC5: Given: 2つ以上のトピックのkeywordsに同時に一致する記事 / When: classifyする
  // Then: TOPICS.md内で先に宣言されたトピックが採用される
  it("AC5: 複数トピックに一致する場合は先に宣言されたトピックを採用する", () => {
    const item = makeItem({ title: "ReactとTypeScriptの型定義パターン" });

    expect(classify(item, topics)).toEqual({ topic: "React", relevance: "high" });
  });

  // AC6: Given: キーワードと記事本文とで大文字小文字が異なる / When: classifyする
  // Then: 大文字小文字を無視して一致する
  it("AC6: キーワードの大文字小文字を無視して一致する", () => {
    const item = makeItem({ title: "REACT Compilerの最新動向" });

    expect(classify(item, topics)).toEqual({ topic: "React", relevance: "high" });
  });
});
