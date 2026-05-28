@AGENTS.md
# Project Memory

このプロジェクトの概要・技術スタック・構成・注意点は `AGENTS.md` にまとめてある。
作業開始時は必ず `AGENTS.md` を読んでから判断すること。

毎回 `find` で全探索しない。
まず以下だけ読む:
1. AGENTS.md
2. package.json
3. 変更対象に関係する src 配下の局所ファイル

# Investigation Rules

- 最初からプロジェクト全体を find / grep で総当たりしない
- まず AGENTS.md を読む
- 次に package.json を読む
- その後、目的に関係するディレクトリだけ調査する
- 認証なら `src/app/api/auth`, `src/lib/auth`, `src/lib/db/schema.ts`
- DBなら `src/lib/db/schema.ts`, `src/lib/storage.ts`
- AI生成なら `src/lib/ai/`
- メールなら `src/lib/email.ts`, `src/app/mail/`
- 日程確定なら `src/app/schedule/[token]/`, `src/app/api/schedule/[token]/`

# SyncMatch AI — プロジェクト概要

大学生が教員・先輩などへの面談依頼をAIでサポートするアプリ。
様々な人が使える将来性も考えてる
相談内容の入力 → 日程スコアリング → メッセージ自動生成 → 確定リンクとメール文共有、という一連のフローを提供する。

## 技術スタック

- **Next.js 16** (App Router) + TypeScript + React 19
- **Neon PostgreSQL** + **Drizzle ORM** (スキーマは `src/lib/db/schema.ts`)
- **NextAuth v5 beta** (Google OAuth)
- **Claude API** (文章生成: `src/lib/ai/`)
- **Resend** (メール通知: `src/lib/email.ts`)
- **Vercel** デプロイ

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx           # ダッシュボード（相談一覧・ステータス管理）
│   ├── profile/           # プロフィール設定
│   ├── request/           # 相談リクエスト作成
│   ├── match/             # 日程スコアリング・候補選択
│   ├── mail/              # メッセージ生成・確認・送信
│   ├── schedule/[token]/  # 相手向け日程確定ページ
│   └── api/
│       ├── auth/          # NextAuth エンドポイント
│       ├── profile/       # GET/POST プロフィール
│       ├── consultations/ # GET/POST 相談記録
│       └── schedule/[token]/ # 日程確定API（Resend通知付き）
├── lib/
│   ├── ai/                # AIモジュール（parser, selector, analyzer, scorer, privacy, mailGen, mailCheck）
│   ├── db/schema.ts       # DBスキーマ（profiles, consultations テーブル）
│   ├── storage.ts         # getConsultations / upsertConsultation など
│   └── email.ts           # sendConfirmedNotification / sendReschedulingNotification
└── types/index.ts         # 全型定義（ConsultationRecord, ConsultRequest, UserProfile など）
```

## データモデルの要点

- `ConsultationRecord` が中心的なデータ単位。`status` フィールドで進行状況を管理。
- ステータス遷移: `draft` → `matched` → `composed` → `sent` / `waiting` → `confirmed` / `rescheduling`
- `waiting`: スケジュール確定リンクを相手に送った状態（`scheduleToken` あり）
- `sent`: メッセージを手動コピーして送信済み（確定リンクなし）
- DBは JSONB で `ConsultationRecord` 全体を保存。`status` と `scheduleToken` のみ専用カラム。

## 開発コマンド

```bash
npm run dev       # 開発サーバー起動 (localhost:3000)
npm run build     # ビルド
npx tsc --noEmit  # 型チェック（プッシュ前に必ず実行）
npm run db:push   # DBスキーマをNeonに反映
```

## 注意事項

- `RESEND_API_KEY` が未設定の場合はメール通知をスキップする（`src/lib/email.ts` のlazy初期化パターン）
- `navigator.share()` はモバイルのみ有効。PCでは表示しない条件分岐が必要。
- NextAuth v5 はまだbeta。`auth()` ヘルパーの使い方が v4 と異なる。
