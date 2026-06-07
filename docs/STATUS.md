# Status

> GeneratorがTASK完了ごとに更新する。

最終更新: 2026-06-08 07:21

## 全体進捗

- 総TASK数: 20
- 完了: 0
- Evaluator確認待ち: 4
- 不合格/修正中: 0
- 未着手: 16

## TASK別ステータス

| TASK | 名前 | 状態 | commit | 備考 |
|---|---|---|---|---|
| TASK-001 | プロジェクト初期セットアップ | [?] Evaluator確認待ち | c2289e5 | Astro+Hono モノレポ構築完了 |
| TASK-002 | ランディングページ | [?] Evaluator確認待ち | 55ca97d | プロダクト名・説明文・Googleログインボタン実装 |
| TASK-003 | ロール選択画面 | [?] Evaluator確認待ち | 04444f0 | 先生/学生ロール選択画面実装 |
| TASK-004 | 先生ダッシュボード UI | [?] Evaluator確認待ち | 176d68c | 週ビューカレンダー・承認待ちリスト・学生課題一覧実装 |
| TASK-005 | 学生ダッシュボード UI | [ ] 未着手 | — | — |
| TASK-006 | チャット画面 UI | [ ] 未着手 | — | — |
| TASK-007〜020 | Phase 2・3 | [ ] 未着手 | — | — |

## 直近のアクティビティ

- 2026-06-08: TASK-004 完了。/teacher 先生ダッシュボード実装。週ビューカレンダー（ダミー空き枠3件・緑色表示）・承認待ちリスト2件（承認/差し戻しボタン付き）・学生課題一覧3件・AIチャットリンク2箇所。npm run build 通過確認。commit: 176d68c
- 2026-06-08: TASK-003 完了。/onboarding ロール選択画面実装。「先生として始める」→/teacher、「学生として始める」→/student。npm run build 通過確認。commit: 04444f0
- 2026-06-08: TASK-002 完了。ランディングページ実装。プロダクト名・サービス説明文3文・GoogleロゴSVG付きログインボタン（/onboardingダミー遷移）。npm run build 通過確認。commit: 55ca97d
- 2026-06-08: TASK-001 完了。既存Next.jsを全削除し、frontend/(Astro 5+React+Tailwind 4) / api/(Hono+Wrangler) モノレポをセットアップ。npm run build 通過確認。commit: c2289e5
