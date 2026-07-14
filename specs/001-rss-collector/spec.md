# 001: RssCollector と v0.1 一気通貫パイプライン

- status: approved

## 目的(なぜ作るか)

v0.1 の最小構成として「RSS 1本以上 → articles/ 保存 → Qiita限定共有投稿」を一気通貫で動かし、
パイプライン全体のレイヤー構造(docs/DESIGN.md)を実コードとして確立する。

## 要件(何ができればよいか)

- config.yaml の feeds に指定した RSS フィード(複数可)を取得し、NewsItem[] に正規化できる
- 取得したURLはトラッキングパラメータを除去する正規化を行った上で、state.json の既出URLと照合し、新規記事のみを対象にできる
- 新規記事から Markdown を生成し、articles/YYYY/MM/YYYY-MM-DD.md に保存できる(各記事にタイトル・URL・公開日を含む)
- 同じ内容を Qiita API v2 で限定共有(private: true)として投稿できる
- 処理した新規記事のURLを state.json に反映(追記)できる
- 複数フィードのうち一部が取得に失敗しても、成功したフィードの記事は処理を継続できる
- エラーは `logs/errors/YYYY-MM-DD.json`(日時・フェーズ・エラー種別を含む構造化JSON)への記録と `console.error` への出力の両方を行う
- 同日に articles/ の当日ファイルが既に存在する場合は、新規記事のみを追記する(新規記事が無ければ何もしない)
- `pnpm run digest` で上記が一括実行できる

## 受け入れ条件

- Given: フィードに未読記事が3件ある / When: digest を実行
  Then: articles/ に当日ファイルが作成され、タイトル・URL・公開日を含む3件が記載され、
        3件のURLが state.json に追記される

- Given: 全記事が state.json に既出 / When: digest を実行
  Then: ファイル生成も投稿も行われず、state.json も変化せず、exit code 0 で終了する

- Given: フィードが記事0件を返す / When: digest を実行
  Then: ファイル生成も投稿も行われず、exit code 0 で終了する

- Given: 未読3件・既出2件が混在する / When: digest を実行
  Then: 未読3件のみが articles/ と state.json に反映され、既出2件は含まれない

- Given: 登録フィード2本のうち1本が取得に失敗する / When: digest を実行
  Then: 失敗が logs/errors/YYYY-MM-DD.json への追記と console.error の両方に記録され、
        成功したフィードの記事は通常どおり処理され、exit code 0 で終了する

- Given: 唯一のフィード取得が失敗する / When: digest を実行
  Then: エラーが logs/errors/YYYY-MM-DD.json と console.error の両方に記録され、
        ファイル生成・投稿は行われないが、exit code 0 で終了する

- Given: QIITA_TOKEN が未設定 / When: digest を実行
  Then: articles/ 保存は行われ、投稿がスキップされる旨が console.error に出力され、exit code 0 で終了する

- Given: articles/ への保存は成功したが Qiita API 呼び出しが失敗する(トークン不正・レート制限等)
  / When: digest を実行
  Then: articles/ への保存済み内容は保持され、投稿失敗が logs/errors/YYYY-MM-DD.json と
        console.error の両方に記録され、exit code 0 で終了する

- Given: state.json ファイルが存在しない(初回実行) / When: digest を実行
  Then: 全記事が新規として扱われ、実行後に state.json が新規作成される

- Given: 同日に articles/YYYY-MM-DD.md が既に存在し、新規記事が1件ある / When: digest を実行
  Then: 既存ファイルの内容は保持されたまま新規1件が追記され、state.json にも
        そのURLが追記されるが、Qiita への投稿は行われない(スキップ)

- Given: 同日に articles/YYYY-MM-DD.md が既に存在し、新規記事が0件 / When: digest を実行
  Then: ファイルは変更されず、state.json も変化せず、Qiita 投稿も行われず、exit code 0 で終了する

- Given: フィード取得で得た記事のURLにトラッキングパラメータ(例: ?utm_source=...)が付与されており、
  正規化後のURLが state.json の既出URLと一致する / When: digest を実行
  Then: 当該記事は既出として扱われ、articles/ にも state.json にも追加されない

- Given: 新規記事が生成された場合 / When: articles/ の Markdown と Qiita への投稿内容を確認する
  Then: 各記事についてタイトル・URL・公開日の3項目が両方の出力に存在することを確認できる
        (レイアウトや文言などの詳細フォーマットは検証対象外)

## スコープ外(今回やらないこと)

- GitHubReleasesCollector(→ 002)
- TOPICS.md によるフィルタリング(→ 003)
- LLM要約
- git commit & push(state.json / articles/ / logs/ のコミットバック)。GitHub Actions workflow
  側の責務とし、本specでは行わない
- 同日再実行時の既存Qiita投稿の更新(タイトル・本文の再送信)。再実行時は常に投稿をスキップし、
  新規投稿も更新も行わない

## 関連

- docs/DESIGN.md「パイプライン全体像」「レイヤー設計 1, 2, 4, 5」
