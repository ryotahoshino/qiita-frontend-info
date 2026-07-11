# qiita-frontend-digest

フロントエンドの最新ニュースを毎日収集し、Markdown記事として保存・Qiitaに自動投稿するツール。

> 🚧 開発中。設計は [docs/DESIGN.md](docs/DESIGN.md) を参照。

## Features

<!-- TODO: v0.1完成時に記述 -->

## How it works

パイプラインの全体像は [docs/DESIGN.md](docs/DESIGN.md) のMermaid図を参照。

## Setup

<!-- TODO: トークン発行 → Secrets登録 → config.yaml編集 の手順 -->

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
