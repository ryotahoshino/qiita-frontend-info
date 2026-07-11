# 収集トピック

このファイルは「何を拾いたいか」の宣言的な定義。`##` 見出しと `keywords:` 行は
パーサーが読むため形式を守ること。`note` は自由記述(LLMありモードでのみ判定に使われる)。

## React / Next.js
- priority: high
- keywords: react, server components, rsc, next.js, react compiler
- note: RSC関連のRFCや設計議論は必ず拾う。入門チュートリアル系は不要。

## TypeScript
- priority: high
- keywords: typescript, tsconfig, type-level, tsc
- note: リリースノートと型システムの新機能を優先。

## UIコンポーネント / デザインシステム
- priority: high
- keywords: mui, material ui, storybook, design system, accessibility, a11y
- note: 共通コンポーネント設計・a11yレビューに関わる話題は優先度高。

## ビルドツール / モノレポ
- priority: medium
- keywords: vite, turbopack, pnpm, esbuild, rollup

## フロントエンドセキュリティ
- priority: medium
- keywords: csp, trusted types, supply chain, npm audit, xss
- note: npmサプライチェーン攻撃の事例は必ず拾う。

## Linux / インフラ入門
- priority: medium
- keywords: systemd, debian, shell, container
- note: フロントエンドとの接点(CI、コンテナ)があるものを優先。

## 除外条件
- 単なる求人・イベント告知
- 内容の薄いまとめ・キュレーション記事
- 特定製品の宣伝のみの記事
