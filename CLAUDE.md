@AGENTS.md

# 自律開発環境 — 3エージェント運用ルール

このプロジェクトは **Planner / Generator / Evaluator** の3エージェント構成で自律的に開発を進める。

## エージェントの役割分担

| エージェント | 役割 | 使うファイル |
|---|---|---|
| Planner | アイデア → 仕様・タスク分解 | `idea.md` → `docs/PROJECT_PLAN.md`, `docs/REQUIREMENTS.md`, `docs/MVP_TASKS.md`, `docs/SPRINT_CONTRACT.md` |
| Generator | タスクを1つずつ実装 | `docs/MVP_TASKS.md` → コード → `docs/STATUS.md` |
| Evaluator | Playwright MCPで実際に操作して評価 | `docs/REQUIREMENTS.md`, `docs/SPRINT_CONTRACT.md`, `docs/EVALUATION_CRITERIA.md` |

## 運用ルール

- **Plannerが仕様とTASKを作る** — `idea.md` を読み、実装者が判断不要になるレベルまで仕様を落とす
- **GeneratorはTASKを1つずつ実装する** — 複数TASKの同時実装禁止
- **EvaluatorはPlaywright MCPで実際に操作して評価する** — コードレビューだけでは不合格にならない
- **作る役と評価する役を分ける** — Generatorが自己評価だけで完了扱いにしない
- **1TASKごとに build と commit を行う** — buildが通らない状態でcommitしない
- **危険な操作は人間に確認する** — 以下は人間の許可なしに実行しない:
  - `git push` / 本番デプロイ
  - 外部API接続の新規追加
  - DB導入・スキーマ変更（Plannerが指示した場合を除く）
  - 認証機能の導入
  - `package.json` への依存関係追加
- **.env、secret、API keyには触れない** — 読む・書く・変更すべて禁止

## ファイル構成

```
idea.md                        # 人間が書くアイデア（1〜4行）
docs/
  PROJECT_PLAN.md              # アプリ概要・目的・ユーザー定義
  REQUIREMENTS.md              # 機能一覧・画面一覧・ユーザーフロー
  MVP_TASKS.md                 # タスク一覧（状態管理付き）
  STATUS.md                    # 全体進捗
  SPRINT_CONTRACT.md           # 各TASKの完了条件
  ERROR_FIX_LOOP.md            # エラー修正手順
  EVALUATION_CRITERIA.md       # Evaluatorの評価基準
.claude/agents/
  planner.md                   # Plannerエージェント定義
  generator.md                 # Generatorエージェント定義
  evaluator.md                 # Evaluatorエージェント定義（Playwright MCP付き）
```
