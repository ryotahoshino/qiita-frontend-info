# 001: RssCollector と v0.1 一気通貫パイプライン

- status: draft(← Claude Codeと壁打ちして固め、承認したら approved に変更)

## 目的(なぜ作るか)

v0.1 の最小構成として「RSS 1本 → articles/ 保存 → Qiita限定共有投稿」を一気通貫で動かし、
パイプライン全体のレイヤー構造(docs/DESIGN.md)を実コードとして確立する。

## 要件(何ができればよいか)

- config.yaml の feeds に指定した RSS フィードを取得し、NewsItem[] に正規化できる
- state.json の既出URLと照合し、新規記事のみを対象にできる
- 新規記事から Markdown を生成し、articles/YYYY/MM/YYYY-MM-DD.md に保存できる
- 同じ内容を Qiita API v2 で限定共有(private: true)として投稿できる
- `pnpm run digest` で上記が一括実行できる

## 受け入れ条件(たたき台 — 壁打ちで具体化する)

- Given: フィードに未読記事が3件ある / When: digest を実行 / Then: articles/ に当日ファイルが作成され3件が含まれる
- Given: 全記事が state.json に既出 / When: digest を実行 / Then: ファイル生成も投稿も行われず、正常終了する
- Given: フィード取得が失敗する / When: digest を実行 / Then: エラーが記録され、プロセスは異常終了しない
- Given: QIITA_TOKEN が未設定 / When: digest を実行 / Then: articles/ 保存は行われ、投稿はスキップされる旨が出力される

## スコープ外(今回やらないこと)

- GitHubReleasesCollector(→ 002)
- TOPICS.md によるフィルタリング(→ 003)
- LLM要約

## 関連

- docs/DESIGN.md「パイプライン全体像」「レイヤー設計 1, 2, 4, 5」
