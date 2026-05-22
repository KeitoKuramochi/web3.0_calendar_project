# Issue #1: プロジェクトの初期構築 (feature/setup)

## 📌 概要
本プロジェクトの基盤となる Next.js プロジェクトの初期化、TypeScript、および Vanilla CSS (CSS Modules) の環境を構築します。また、グローバルCSSや基本的なレイアウト（ヘッダー、フッター、ナビゲーション）を作成します。

## 🎯 ゴール
- Next.js (App Router) プロジェクトがローカルで起動できること
- TypeScript が適切に設定されていること
- Vanilla CSS で設計された共通レイアウトが表示されること
- 余分なデフォルトファイル（Tailwindの設定など）がクリーンアップされていること

## 🛠️ 作業手順
1. `feature/setup` ブランチを作成して切り替える
2. `create-next-app` コマンドで TypeScript 構成を初期化（Tailwind CSS は無効化）
3. フォルダ構成を整理（`src/app`, `src/components`, `src/lib`, `src/types` の作成）
4. `src/app/globals.css` にグローバル変数（カラーパレット、フォントなど）とリセットCSSを定義
5. `src/app/layout.tsx` と `src/app/page.tsx` を基本設計に基づき記述
6. 開発サーバーを起動し、動作確認を行う
7. 変更をコミットし、`main` ブランチにマージする（PRシミュレーション）
