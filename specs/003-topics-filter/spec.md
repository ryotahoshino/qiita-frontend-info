# 003: TOPICS.mdによるフィルタリング(キーワードマッチ)

- status: approved

## 目的(なぜ作るか)

`TOPICS.md` に宣言したトピック定義に基づき、収集した記事を「拾う/拾わない」「どのトピックか」に
分類できるようにする。これにより articles/ には関心のある話題だけが、トピックごとのセクションに
整理された形で出力されるようになる。除外された記事は `logs/skipped/` に残し、`TOPICS.md` を
育てるための材料にする(DESIGN.mdロードマップ v0.2)。

CLAUDE.mdの原則により、本specは **キーワードマッチのみ** で完結させる(LLMなしでも全機能が動くこと)。
LLMありモード(`note` のニュアンス判定)は別specとする。

## 前提(現状の確認)

- `TOPICS.md` は既に存在し、`##` 見出し + `- priority: high|medium` + `- keywords: ...` の
  構造規約で6トピックが定義されている(React/Next.js、TypeScript、UIコンポーネント、
  ビルドツール、フロントエンドセキュリティ、Linux/インフラ)
- 末尾に `## 除外条件` セクションがあるが、`keywords:` 行を持たない自由記述の箇条書きであり、
  構造上 **キーワードマッチでは判定できない**(LLMモード専用)
- DESIGN.md の `TopicMatcher` インターフェース:
  `classify(item: NewsItem): { topic: string; relevance: "high" | "medium" | "skip" }`
- DESIGN.md のディレクトリ構成表で `TopicMatcher` は `src/core/` に属すると明記されている
- DESIGN.md「TOPICS.mdからrender層へ渡すのはセクション名の一覧のみ」の疎結合を維持する必要がある

## 要件(何ができればよいか)

- `src/core/topicMatcher.ts` に以下を実装する
  - `parseTopics(markdown: string): Topic[]` — `TOPICS.md` の内容から、`keywords:` 行を持つ
    `##` 見出しのみをトピックとして抽出する(`## 除外条件` のような `keywords:` の無い見出しは
    トピックとして扱わない)
  - `classify(item: NewsItem, topics: Topic[]): { topic: string; relevance: "high" | "medium" | "skip" }`
    — `item.title` と `item.summary`(存在すれば)を対象に、`topics` の宣言順で各トピックの
    `keywords` を大文字小文字を無視した部分一致で検査する。最初に一致したトピックの `name` と
    `priority`(= relevance)を返す。どのトピックにも一致しなければ `{ topic: "", relevance: "skip" }`
- `logs/skipped/YYYY-MM-DD.json` への書き込みアダプタを `src/core/skippedLog.ts` に実装する
  (`src/core/errorLog.ts` と同様のパターン: パス生成の純粋関数 + 追記I/O関数)。1件ごとに
  `title` / `url` / `source` / `publishedAt` を記録する
- `src/digest.ts` の `runDigest` に分類ステップを追加する
  - dedupで新規と判定された記事それぞれに `classify` を適用する
  - `relevance === "skip"` の記事は articles/ に含めず、`logs/skipped/YYYY-MM-DD.json` に記録する
  - skip記事のURLも(再分類・再ログを防ぐため)`state.json` の `seenUrls` に含める
  - skipでない記事は、トピックごとにグループ化して Renderer に渡す
- `src/render/renderDigest.ts` の `renderArticles` / `appendArticles` を、フラットな記事一覧では
  なく「トピック名 → 記事一覧」のグループ単位で受け取る形に変更する。出力Markdownは
  `TOPICS.md` の宣言順にセクション(`## トピック名`)を生成し、該当記事が0件のトピックの
  セクションは出力しない
- `src/main.ts` で `TOPICS.md` を読み込み `parseTopics` した結果を `DigestDeps` に渡す配線を追加する
- `config.yaml` の `llm.enabled` は本specでは参照しない(常にキーワードマッチのみで動作する)

## 受け入れ条件

本specは純粋なアプリケーションロジック(ファイルパース・分類・Markdown生成)であり、
GitHub Actions等の外部実行環境に依存しないため、受け入れ条件はすべて `[vitest]` で検証する。

- `[vitest]` Given: `keywords: react, rsc` を持つ「React」トピックが定義されている
  / When: タイトルに"React Server Components"を含む記事を `classify` する
  Then: `{ topic: "React", relevance: "high" }`(トピックの `priority` がそのまま返る)のように、
        一致したトピック名とそのトピックの `priority` が返る

- `[vitest]` Given: どのトピックの `keywords` にも一致しない記事
  / When: `classify` する
  Then: `{ topic: "", relevance: "skip" }` が返る

- `[vitest]` Given: `keywords:` 行を持たない `## 除外条件` セクションを含む `TOPICS.md`
  / When: `parseTopics` でパースする
  Then: `除外条件` はトピック一覧に含まれない(`keywords:` の無い見出しはトピックとして扱わない)

- `[vitest]` Given: タイトルには一致しないが `summary` にキーワードが含まれる記事
  / When: `classify` する
  Then: `summary` も判定対象となり、一致したトピックが返る

- `[vitest]` Given: 2つ以上のトピックの `keywords` に同時に一致する記事
  / When: `classify` する
  Then: `TOPICS.md` 内で先に宣言されたトピックが採用される

- `[vitest]` Given: `TOPICS.md` 側のキーワードと記事本文とで大文字小文字が異なる
  (例: キーワードは `react`、記事は `React Compiler`)
  / When: `classify` する
  Then: 大文字小文字を無視して一致する

- `[vitest]` Given: 新規記事3件のうち1件がどのトピックにも一致しない
  / When: `digest` を実行する
  Then: 一致した2件のみが `articles/` に反映され、一致しなかった1件は
        `logs/skipped/YYYY-MM-DD.json` に記録され、`articles/` には含まれない

- `[vitest]` Given: 新規記事がどのトピックにも一致せず skip される
  / When: `digest` を実行する
  Then: そのURLは `state.json` の `seenUrls` に追加される(翌日以降の実行で再取得されても
        再度skip判定・再ログされない)

- `[vitest]` Given: 新規記事が複数トピックにまたがって分類される(例: React 2件、TypeScript 1件)
  / When: `digest` を実行し `articles/` を生成する
  Then: 生成されたMarkdownは `TOPICS.md` のトピック宣言順にセクション分けされ、
        各セクション見出しにトピック名が含まれる

- `[vitest]` Given: 該当記事が0件のトピックがある
  / When: `articles/` を生成する
  Then: そのトピックのセクション見出しは出力されない(空セクションを作らない)

- `[vitest]` Given: dedupで新規と判定された記事が存在するが、全件が skip 判定される
  / When: `digest` を実行する
  Then: `articles/` への書き込みは行われないが、全件のURLが `state.json` に追加され、
        全件が `logs/skipped/YYYY-MM-DD.json` に記録される。exit code は 0

- `[vitest]` Given: `config.yaml` の `llm.enabled` が `false`(デフォルト)または未設定
  / When: `digest` を実行する
  Then: キーワードマッチのみで分類され、LLM API等の外部呼び出しは一切発生しない

## スコープ外(今回やらないこと)

- LLMありモード(`TOPICS.md` 全文をプロンプトに注入し `note` のニュアンスも含めて判定)。
  `config.yaml` の `llm.enabled: true` は本specでは無視され、常にキーワードマッチのみで動作する
  (LLMモードの実装は別spec、004以降)
- skippedログをLLMに分析させ `TOPICS.md` への追記案をPRとして自動作成する機能
  (DESIGN.mdロードマップ v0.3、別spec)
- 1記事が複数トピックに同時に(重複して)掲載される設計。本specでは最初に一致した
  1トピックへの排他的な分類のみを行う
- `TOPICS.md` 自体のバリデーション強化(不正フォーマット時の詳細なエラー通知等)。
  `keywords:` の無い見出しを単に無視する、という最小限の耐性のみ持たせる
- GitHubReleasesCollector、Qiita投稿の複数トピック別記事化(1日1記事の構成は維持する)

## 関連

- docs/DESIGN.md「レイヤー設計 3. Filter / Classifier(TOPICS.md 駆動)」「ディレクトリ構成」
- TOPICS.md
- specs/001-rss-collector/spec.md(`NewsItem` / `runDigest` / `renderArticles` の前提)
- CLAUDE.md「LLM要約・LLM分類はオプトイン。APIキーなしでもキーワードマッチで全機能が動くこと」
