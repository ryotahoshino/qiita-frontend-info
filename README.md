# qiita-frontend-digest

フロントエンドの最新ニュースを毎日収集し、Markdown記事として保存・Qiitaに自動投稿するツール。

> 🚧 開発中。設計は [docs/DESIGN.md](docs/DESIGN.md) を参照。

## Features

<!-- TODO: v0.1完成時に記述 -->

## How it works

パイプラインの全体像は [docs/DESIGN.md](docs/DESIGN.md) のMermaid図を参照。

## Setup

1. **Qiitaトークンを発行する**
   Qiitaの [個人用アクセストークン発行ページ](https://qiita.com/settings/tokens/new) で `read_qiita` /
   `write_qiita` スコープのトークンを発行する。

2. **GitHub Secretsに登録する**
   このリポジトリの `Settings > Secrets and variables > Actions > New repository secret` から、
   Name: `QIITA_TOKEN`、Value: 発行したトークン、で登録する。
   トークンはコード・config・テストに直書きしないこと(GitHub Secrets経由でのみ渡す)。

3. **`config.yaml` を編集する**
   ローカルで実行する場合は [Configuration](#configuration) の手順で `config.yaml` を作成し、
   収集したいフィードを編集する。
   GitHub Actions(`.github/workflows/daily.yml`)では `config.yaml.example` がそのまま
   `config.yaml` として使われるため、実運用のフィード構成を変えたい場合は
   `config.yaml.example` 自体を編集してコミットする。

## Configuration

`config.yaml.example` をコピーして `config.yaml` を作成する。

## Adding a collector

`src/collectors/types.ts` の `Collector` インターフェースを実装する。

## Development

```bash
pnpm install
pnpm test
pnpm run digest
```

開発プロセスは仕様駆動([specs/README.md](specs/README.md))。

## Roadmap

- v0.1: RSS 1本 → articles/ 保存 → Qiita限定共有投稿
- v0.2: GitHub Releases対応、TOPICS.mdフィルタ、skippedログ
- v0.3: skippedログのLLM分析によるTOPICS.md追記案の自動PR

## License

MIT
