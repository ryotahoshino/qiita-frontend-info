# qiita-frontend-digest

フロントエンドの最新ニュースを毎日収集し、Markdown記事として保存・Qiitaに自動投稿するOSSツール。

## Features

- RSSフィードから記事を収集し、URLを正規化して既出記事を重複排除する(`state.json`で管理)
- `TOPICS.md`のキーワードマッチで記事をトピックに分類する(APIキー不要、デフォルト動作)
- オプトインでAnthropic APIによるLLM分類に切り替えられる(`TOPICS.md`の`note`のニュアンスも考慮。失敗時はキーワードマッチにフォールバック)
- トピック別にセクション分けしたMarkdownを日付別アーカイブ(`articles/YYYY/MM/YYYY-MM-DD.md`)として保存し、Qiitaへ限定共有(`private: true`)で自動投稿する
- GitHub Actionsで毎日自動実行し、`state.json` / `articles/` / `logs/` の変更をリポジトリへコミットバックする

## How it works

```mermaid
flowchart TD
    A[GitHub Actions cron<br>毎日 JST 朝 / UTC 22:00] --> B[RssCollector<br>config.yamlのfeedsを収集]
    B --> C[正規化・重複排除<br>state.jsonで既出URL管理]
    C --> D[Classifier<br>TOPICS.mdキーワードマッチ<br>(オプション: Anthropic LLM)]
    D --> E[Renderer<br>トピック別Markdown生成]
    E --> F[FilePublisher<br>articles/YYYY/MM/YYYY-MM-DD.md]
    E --> G[QiitaPublisher<br>API v2 / private: true]
    F --> H[git commit & push<br>state.json + articles/ + logs/]
```

詳細な設計は [docs/DESIGN.md](docs/DESIGN.md) を参照。

## Setup

1. **Qiitaトークンを発行する**
   Qiitaの [個人用アクセストークン発行ページ](https://qiita.com/settings/tokens/new) で `read_qiita` /
   `write_qiita` スコープのトークンを発行する。

2. **GitHub Secretsに登録する**
   このリポジトリの `Settings > Secrets and variables > Actions > New repository secret` から、
   Name: `QIITA_TOKEN`、Value: 発行したトークン、で登録する。
   トークンはコード・config・テストに直書きしないこと(GitHub Secrets経由でのみ渡す)。

3. **`config.yaml` を作成する**
   [Configuration](#configuration) の手順で `config.yaml` を作成し、収集したいフィードを編集する。
   GitHub Actions(`.github/workflows/daily.yml`)では `config.yaml.example` がそのまま
   `config.yaml` として使われるため、実運用のフィード構成を変えたい場合は
   `config.yaml.example` 自体を編集してコミットする。

4. **(オプション)LLMありモード用のAnthropic APIキーを設定する**
   `config.yaml` の `llm.enabled: true` にした場合のみ必要(デフォルトは`false`でキーワード
   マッチのみで動作する)。
   - ローカル: `.env.example` を `.env.local`(`.gitignore`対象)にコピーし、
     `ANTHROPIC_API_KEY=` の値を設定したうえで、実行前にシェルの環境変数として読み込む
     (例: PowerShellなら `$env:ANTHROPIC_API_KEY = "..."`)。このプロジェクトは `.env.local` を
     自動読み込みしないため、シェルへのエクスポートが必要
   - GitHub Actions: このリポジトリの `Settings > Secrets and variables > Actions` から
     Name: `ANTHROPIC_API_KEY`、Value: 発行したAPIキー、で登録する
   - APIキーはコード・config・テストに直書きしないこと(`.env.local` / GitHub Secrets経由でのみ渡す)

5. **GitHub Actionsを有効化する**
   フォーク・clone後は `Actions` タブでワークフローを有効化する。`.github/workflows/daily.yml`が
   毎日(UTC 22:00 = JST翌朝7:00)自動実行され、`workflow_dispatch`から手動実行もできる。

6. **(推奨)ブランチ保護ルールを設定する**
   `main` へのマージ前に `.github/workflows/ci.yml`(`pnpm test` ・型チェック)が必ず通ることを
   強制したい場合は、このリポジトリの `Settings > Branches > Branch protection rules` から
   `main` を対象に「Require status checks to pass before merging」を有効化し、`ci` ジョブを
   必須チェックに追加する。この設定操作自体は任意のGitHub UI操作であり、`ci.yml` の動作自体には
   影響しない(未設定でもCIは実行されるが、チェック失敗時にマージをブロックしなくなる)。

## Configuration

`config.yaml.example` をコピーして `config.yaml` を作成する(`config.yaml` 自体はコミットしない)。

```bash
cp config.yaml.example config.yaml
```

| キー | 型 | デフォルト | 説明 |
|---|---|---|---|
| `feeds` | `{ name: string, url: string }[]` | `[]` | 収集するRSSフィードのリスト |
| `github_releases` | `{ owner: string, repo: string }[]` | `[]` | 予約フィールド。GitHubReleasesCollectorは未実装のため現状は読み込まれるだけで使われない(Roadmap参照) |
| `qiita.private` | `boolean` | `true` | Qiita投稿を限定共有にするか。`false`にすると公開投稿になるため、変更は人間が明示的に行うこと |
| `qiita.tags` | `string[]` | `["frontend", "news"]` | Qiita投稿に付与するタグ |
| `llm.enabled` | `boolean` | `false` | `true`かつ環境変数`ANTHROPIC_API_KEY`が設定されている場合のみ、LLM分類(オプトイン)を使う |

## Topics

`TOPICS.md` は「何を拾うか」を宣言的に定義するファイル。`##`見出し・`- priority:`・`- keywords:`の
3点だけが構造規約として固定されており、それ以外は自由記述。

```markdown
## トピック名
- priority: high | medium
- keywords: キーワード1, キーワード2, キーワード3
- note: 自由記述(LLMありモードでのみ判定に使われる。キーワードマッチでは無視される)
```

- `keywords:`は記事のタイトル・summaryに対して大文字小文字を無視した部分一致で判定される
- 複数トピックに一致する場合は`TOPICS.md`内で先に宣言されたトピックが優先される
- `keywords:`行を持たない見出し(`TOPICS.md`内の`## 除外条件`など)はキーワードマッチの対象外になる
  (LLMありモードでのみ自然言語のニュアンスとして考慮される)

**トピックを追加する方法**: `TOPICS.md`に新しい`##`見出しを追記するだけでよい。コードの変更は不要で、
Rendererの出力セクションも自動的に追加される。

## Adding a collector

Collectorは記事の収集元を表すプラグイン。`src/collectors/types.ts`のインターフェースを実装する。

```typescript
interface NewsItem {
  title: string;
  url: string;
  publishedAt: Date;
  source: string;
  summary?: string;
}

interface Collector {
  name: string;
  fetch(): Promise<NewsItem[]>;
}
```

`src/collectors/rssCollector.ts`(`createRssCollector`)が参照実装。新しいCollectorを追加する場合は、
実レスポンスの縮小版フィクスチャを`tests/fixtures/`に置いてテストする(CLAUDE.md参照)。
実装したCollectorは`src/main.ts`で`DigestDeps.collectors`配列に追加して配線する。

## Development

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run digest
```

`main` へのPull Request作成時・push時は `.github/workflows/ci.yml` が自動的に
`pnpm test` と `pnpm run typecheck` を実行する。

開発プロセスは仕様駆動([specs/README.md](specs/README.md))。新機能は
`specs/NNN-機能名/spec.md`(目的・要件・受け入れ条件・スコープ外)の作成と承認から始め、
受け入れ条件をvitestのテストケースに落としてから実装する。

## Roadmap

**実装済み**

- RSS収集 → 重複排除 → `articles/`保存 → Qiita限定共有投稿の一気通貫パイプライン
- GitHub Actionsでの毎日自動実行とコミットバック
- `TOPICS.md`によるキーワードマッチ分類、トピック別セクション生成
- オプトインのLLMありモード(Anthropic API、フォールバック付き)
- PRトリガーでの自動テスト・型チェック(`ci.yml`)

**今後の予定**

- GitHubReleasesCollector(指定リポジトリのRelease監視)
- v0.3: `logs/skipped/`のログをLLMに分析させ、`TOPICS.md`への追記案を自動PR化する
  「自己成長するニュースフィルタ」

## License

MIT
