// specs/001-rss-collector/spec.md の受け入れ条件(AC1〜AC13)を vitest に落としたもの。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Collector, NewsItem } from "../src/collectors/types.js";
import type { StateFile } from "../src/core/state.js";
import { createKeywordClassifier, type Topic } from "../src/core/topicMatcher.js";
import { runDigest, type DigestDeps } from "../src/digest.js";
import { appendArticles, renderArticles } from "../src/render/renderDigest.js";

// spec 001時点のテストはトピック分類を前提としないため、全記事にマッチするキャッチオール
// トピックを既定値にする(空文字列はどんな文字列にもJavaScriptのString#includesで一致する)。
const CATCH_ALL_TOPIC: Topic = { name: "全般", priority: "high", keywords: [""] };

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    title: "Sample Article",
    url: "https://example.com/sample",
    publishedAt: new Date("2026-07-15T00:00:00Z"),
    source: "TestFeed",
    ...overrides,
  };
}

function makeCollector(name: string, itemsOrFetch: NewsItem[] | Collector["fetch"]): Collector {
  return {
    name,
    fetch: typeof itemsOrFetch === "function" ? itemsOrFetch : async () => itemsOrFetch,
  };
}

function makeDeps(overrides: Partial<DigestDeps> = {}): DigestDeps {
  return {
    collectors: [],
    today: new Date("2026-07-15T00:00:00Z"),
    qiitaToken: "dummy-token",
    topics: [CATCH_ALL_TOPIC],
    topicsMarkdown: "",
    classifier: createKeywordClassifier(),
    loadState: vi.fn(async (): Promise<StateFile | null> => ({ seenUrls: [] })),
    saveState: vi.fn(async () => {}),
    readArticleFile: vi.fn(async (): Promise<string | null> => null),
    writeArticleFile: vi.fn(async () => {}),
    renderArticles: vi.fn(renderArticles),
    appendArticles: vi.fn(appendArticles),
    postToQiita: vi.fn(async () => {}),
    logError: vi.fn(async () => {}),
    logSkipped: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("runDigest — specs/001-rss-collector/spec.md 受け入れ条件", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC1: Given: フィードに未読記事が3件ある / When: digestを実行
  // Then: articles/に当日ファイルが作成され、タイトル・URL・公開日を含む3件が記載され、
  //       3件のURLがstate.jsonに追記される
  it("AC1: 未読記事3件を保存し、state.jsonに3件のURLを追記する", async () => {
    const items = [
      makeItem({ title: "A", url: "https://example.com/a" }),
      makeItem({ title: "B", url: "https://example.com/b" }),
      makeItem({ title: "C", url: "https://example.com/c" }),
    ];
    const deps = makeDeps({ collectors: [makeCollector("feed1", items)] });

    const result = await runDigest(deps);

    expect(deps.writeArticleFile).toHaveBeenCalledTimes(1);
    const [content] = vi.mocked(deps.writeArticleFile).mock.calls[0]!;
    for (const item of items) {
      expect(content).toContain(item.title);
      expect(content).toContain(item.url);
    }
    expect(deps.saveState).toHaveBeenCalledTimes(1);
    const [savedState] = vi.mocked(deps.saveState).mock.calls[0]!;
    for (const item of items) {
      expect(savedState.seenUrls).toContain(item.url);
    }
    expect(result.exitCode).toBe(0);
  });

  // AC2: Given: 全記事がstate.jsonに既出 / When: digestを実行
  // Then: ファイル生成も投稿も行われず、state.jsonも変化せず、exit code 0で終了する
  it("AC2: 全記事が既出の場合、ファイル生成・投稿・state更新のいずれも行わない", async () => {
    const items = [makeItem({ url: "https://example.com/a" }), makeItem({ url: "https://example.com/b" })];
    const deps = makeDeps({
      collectors: [makeCollector("feed1", items)],
      loadState: vi.fn(async () => ({ seenUrls: ["https://example.com/a", "https://example.com/b"] })),
    });

    const result = await runDigest(deps);

    expect(deps.writeArticleFile).not.toHaveBeenCalled();
    expect(deps.saveState).not.toHaveBeenCalled();
    expect(deps.postToQiita).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
  });

  // AC3: Given: フィードが記事0件を返す / When: digestを実行
  // Then: ファイル生成も投稿も行われず、exit code 0で終了する
  it("AC3: フィードが0件の場合、ファイル生成・投稿を行わず正常終了する", async () => {
    const deps = makeDeps({ collectors: [makeCollector("feed1", [])] });

    const result = await runDigest(deps);

    expect(deps.writeArticleFile).not.toHaveBeenCalled();
    expect(deps.postToQiita).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
  });

  // AC4: Given: 未読3件・既出2件が混在する / When: digestを実行
  // Then: 未読3件のみがarticles/とstate.jsonに反映され、既出2件は含まれない
  it("AC4: 未読・既出混在時は未読分のみを反映する", async () => {
    const unread = [
      makeItem({ title: "New1", url: "https://example.com/new1" }),
      makeItem({ title: "New2", url: "https://example.com/new2" }),
      makeItem({ title: "New3", url: "https://example.com/new3" }),
    ];
    const seen = [
      makeItem({ title: "Old1", url: "https://example.com/old1" }),
      makeItem({ title: "Old2", url: "https://example.com/old2" }),
    ];
    const deps = makeDeps({
      collectors: [makeCollector("feed1", [...unread, ...seen])],
      loadState: vi.fn(async () => ({ seenUrls: seen.map((i) => i.url) })),
    });

    await runDigest(deps);

    const [content] = vi.mocked(deps.writeArticleFile).mock.calls[0]!;
    for (const item of unread) {
      expect(content).toContain(item.title);
    }
    for (const item of seen) {
      expect(content).not.toContain(item.title);
    }
    const [savedState] = vi.mocked(deps.saveState).mock.calls[0]!;
    for (const item of unread) {
      expect(savedState.seenUrls).toContain(item.url);
    }
  });

  // AC5: Given: 登録フィード2本のうち1本が取得に失敗する / When: digestを実行
  // Then: 失敗がlogs/errors/YYYY-MM-DD.jsonへの追記とconsole.errorの両方に記録され、
  //       成功したフィードの記事は通常どおり処理され、exit code 0で終了する
  it("AC5: 複数フィードのうち1本が失敗しても、成功したフィードの記事は処理を継続する", async () => {
    const okItems = [makeItem({ title: "OK", url: "https://example.com/ok" })];
    const deps = makeDeps({
      collectors: [
        makeCollector("broken-feed", async () => {
          throw new Error("network error");
        }),
        makeCollector("ok-feed", okItems),
      ],
    });

    const result = await runDigest(deps);

    expect(deps.logError).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    const [content] = vi.mocked(deps.writeArticleFile).mock.calls[0]!;
    expect(content).toContain("OK");
    expect(result.exitCode).toBe(0);
  });

  // AC6: Given: 唯一のフィード取得が失敗する / When: digestを実行
  // Then: エラーがlogs/errors/YYYY-MM-DD.jsonとconsole.errorの両方に記録され、
  //       ファイル生成・投稿は行われないが、exit code 0で終了する
  it("AC6: 唯一のフィードが失敗した場合、エラーを記録しファイル生成・投稿は行わないが異常終了しない", async () => {
    const deps = makeDeps({
      collectors: [
        makeCollector("broken-feed", async () => {
          throw new Error("network error");
        }),
      ],
    });

    const result = await runDigest(deps);

    expect(deps.logError).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(deps.writeArticleFile).not.toHaveBeenCalled();
    expect(deps.postToQiita).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
  });

  // AC7: Given: QIITA_TOKENが未設定 / When: digestを実行
  // Then: articles/保存は行われ、投稿がスキップされる旨がconsole.errorに出力され、exit code 0で終了する
  it("AC7: QIITA_TOKEN未設定時はarticles/保存のみ行い、投稿はスキップする", async () => {
    const deps = makeDeps({
      collectors: [makeCollector("feed1", [makeItem()])],
      qiitaToken: undefined,
    });

    const result = await runDigest(deps);

    expect(deps.writeArticleFile).toHaveBeenCalledTimes(1);
    expect(deps.postToQiita).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
  });

  // AC8: Given: articles/への保存は成功したがQiita API呼び出しが失敗する(トークン不正・レート制限等)
  // Then: articles/への保存済み内容は保持され、投稿失敗がlogs/errors/YYYY-MM-DD.jsonと
  //       console.errorの両方に記録され、exit code 0で終了する
  it("AC8: Qiita投稿が失敗しても保存済みarticles/は保持され、エラーとして記録される", async () => {
    const deps = makeDeps({
      collectors: [makeCollector("feed1", [makeItem()])],
      postToQiita: vi.fn(async () => {
        throw new Error("401 Unauthorized");
      }),
    });

    const result = await runDigest(deps);

    expect(deps.writeArticleFile).toHaveBeenCalledTimes(1);
    expect(deps.logError).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
  });

  // AC9: Given: state.jsonファイルが存在しない(初回実行) / When: digestを実行
  // Then: 全記事が新規として扱われ、実行後にstate.jsonが新規作成される
  it("AC9: state.jsonが存在しない初回実行では全記事を新規として扱い、state.jsonを新規作成する", async () => {
    const deps = makeDeps({
      collectors: [makeCollector("feed1", [makeItem({ url: "https://example.com/first" })])],
      loadState: vi.fn(async () => null),
    });

    await runDigest(deps);

    expect(deps.writeArticleFile).toHaveBeenCalledTimes(1);
    expect(deps.saveState).toHaveBeenCalledTimes(1);
    const [savedState] = vi.mocked(deps.saveState).mock.calls[0]!;
    expect(savedState.seenUrls).toContain("https://example.com/first");
  });

  // AC10: Given: 同日にarticles/YYYY-MM-DD.mdが既に存在し、新規記事が1件ある / When: digestを実行
  // Then: 既存ファイルの内容は保持されたまま新規1件が追記され、state.jsonにもそのURLが追記されるが、
  //       Qiitaへの投稿は行われない(スキップ)
  it("AC10: 当日ファイルが既に存在する状態で新規記事があれば追記し、Qiita投稿はスキップする", async () => {
    const existingContent = "# 既存の当日記事\n\n- [Existing](https://example.com/existing)\n";
    const newItem = makeItem({ title: "Newcomer", url: "https://example.com/newcomer" });
    const deps = makeDeps({
      collectors: [makeCollector("feed1", [newItem])],
      readArticleFile: vi.fn(async () => existingContent),
    });

    await runDigest(deps);

    expect(deps.writeArticleFile).toHaveBeenCalledTimes(1);
    const [content] = vi.mocked(deps.writeArticleFile).mock.calls[0]!;
    expect(content).toContain("Existing");
    expect(content).toContain("Newcomer");
    expect(deps.saveState).toHaveBeenCalledTimes(1);
    const [savedState] = vi.mocked(deps.saveState).mock.calls[0]!;
    expect(savedState.seenUrls).toContain(newItem.url);
    expect(deps.postToQiita).not.toHaveBeenCalled();
  });

  // AC11: Given: 同日にarticles/YYYY-MM-DD.mdが既に存在し、新規記事が0件 / When: digestを実行
  // Then: ファイルは変更されず、state.jsonも変化せず、Qiita投稿も行われず、exit code 0で終了する
  it("AC11: 当日ファイルが存在し新規記事が0件なら、何も変更せず正常終了する", async () => {
    const existingUrl = "https://example.com/existing";
    const deps = makeDeps({
      collectors: [makeCollector("feed1", [makeItem({ url: existingUrl })])],
      loadState: vi.fn(async () => ({ seenUrls: [existingUrl] })),
      readArticleFile: vi.fn(async () => "# 既存の当日記事\n"),
    });

    const result = await runDigest(deps);

    expect(deps.writeArticleFile).not.toHaveBeenCalled();
    expect(deps.saveState).not.toHaveBeenCalled();
    expect(deps.postToQiita).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
  });

  // AC12: Given: フィード取得で得た記事のURLにトラッキングパラメータが付与されており、
  //       正規化後のURLがstate.jsonの既出URLと一致する / When: digestを実行
  // Then: 当該記事は既出として扱われ、articles/にもstate.jsonにも追加されない
  it("AC12: トラッキングパラメータ違いのURLは正規化後の一致で既出として扱う", async () => {
    const deps = makeDeps({
      collectors: [
        makeCollector("feed1", [
          makeItem({ url: "https://example.com/article?utm_source=newsletter&utm_medium=email" }),
        ]),
      ],
      loadState: vi.fn(async () => ({ seenUrls: ["https://example.com/article"] })),
    });

    const result = await runDigest(deps);

    expect(deps.writeArticleFile).not.toHaveBeenCalled();
    expect(deps.saveState).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
  });

  // AC13: Given: 新規記事が生成された場合 / When: articles/のMarkdownとQiitaへの投稿内容を確認する
  // Then: 各記事についてタイトル・URL・公開日の3項目が両方の出力に存在することを確認できる
  //       (レイアウトや文言などの詳細フォーマットは検証対象外の緩い検証)
  it("AC13: 生成されたMarkdownとQiita投稿内容の両方に、各記事のタイトル・URL・公開日が含まれる", async () => {
    const item = makeItem({
      title: "Format Check",
      url: "https://example.com/format-check",
      publishedAt: new Date("2026-07-10T00:00:00Z"),
    });
    const datePart = item.publishedAt.toISOString().slice(0, 10); // "2026-07-10"

    const deps = makeDeps({ collectors: [makeCollector("feed1", [item])] });

    await runDigest(deps);

    const [articleContent] = vi.mocked(deps.writeArticleFile).mock.calls[0]!;
    expect(articleContent).toContain(item.title);
    expect(articleContent).toContain(item.url);
    expect(articleContent).toContain(datePart);

    const [qiitaPayload] = vi.mocked(deps.postToQiita).mock.calls[0]!;
    expect(qiitaPayload.body).toContain(item.title);
    expect(qiitaPayload.body).toContain(item.url);
    expect(qiitaPayload.body).toContain(datePart);
  });

  // コードレビュー起因の回帰テスト(AC1〜13には含まれない):
  // <link>欠落などでURLが不正な記事が1件混ざっていても、正常な記事の処理は継続し、
  // digest全体を異常終了させない。
  it("不正なURLの記事が1件あっても、他の正常な記事の処理を継続する", async () => {
    const badItem = makeItem({ title: "Broken Link", url: "" });
    const goodItem = makeItem({ title: "Good Article", url: "https://example.com/good" });
    const deps = makeDeps({ collectors: [makeCollector("feed1", [badItem, goodItem])] });

    const result = await runDigest(deps);

    expect(result.exitCode).toBe(0);
    expect(deps.logError).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    const [content] = vi.mocked(deps.writeArticleFile).mock.calls[0]!;
    expect(content).toContain("Good Article");
    expect(content).not.toContain("Broken Link");
  });
});
