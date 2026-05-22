/**
 * 5. プライバシー調整AI (モック版)
 * 相手のプライベートな予定理由（例:「〇〇会議」「〇〇学会」「通院」など）を隠蔽し、
 * 「予定あり」「調整が難しい時間帯」などのぼかした表現に自動変換します。
 */
export function sanitizeReason(rawReason: string): string {
  if (!rawReason) return "予定あり";

  // 具体的なプライベート予定を表す単語リストと、その代替ぼかし表現
  const rules = [
    { pattern: /(会議|委員会|教授会|打ち合わせ|ミーティング|審査)/, replacement: "学内業務・会議" },
    { pattern: /(学会|出張|研修|講義|授業|ゼミ生発表)/, replacement: "講義・研究活動" },
    { pattern: /(通院|検診|私用|休暇|休み|帰省)/, replacement: "席外し・対応不可" },
    { pattern: /(昼休み|昼食|ご飯)/, replacement: "窓口混雑時間帯・休憩時間" },
    { pattern: /(体調不良|急用|忌引き)/, replacement: "終日不在" }
  ];

  let sanitized = rawReason;

  rules.forEach(rule => {
    if (rule.pattern.test(sanitized)) {
      sanitized = sanitized.replace(rule.pattern, rule.replacement);
    }
  });

  // もし具体名（鈴木、佐藤など）が含まれていたら削除するなどの処理
  sanitized = sanitized.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[メールアドレス]");

  // 最終的にプライバシーが守られた状態になっていることを保証する文言を追加
  if (sanitized === rawReason) {
    // マッチしなかった場合も、全体をぼかし表現にする
    return "予定調整が難しい時間帯です";
  }

  return `調整可能性低（${sanitized}のため）`;
}

/**
 * 日程表示用に簡略化されたステータス文言を返します。
 */
export function getPrivacyProtectedStatus(score: "excellent" | "good" | "fair" | "poor"): string {
  switch (score) {
    case "excellent":
      return "調整可能性：高（相手の推奨時間枠）";
    case "good":
      return "調整可能性：中（対応可能な時間帯）";
    case "fair":
      return "調整可能性：低（予定が入りやすい時間帯）";
    case "poor":
      return "調整不可（対応時間外、または終日不在等）";
  }
}
