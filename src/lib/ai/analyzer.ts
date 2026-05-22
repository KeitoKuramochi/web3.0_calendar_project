import { UserProfile } from "@/types";

export interface AnalyzedProfile {
  targetUserId: string;
  preferredTimeHints: string[]; // 会いやすい時間の要約 (例: ["金曜午前", "木曜午後"])
  avoidedTimeHints: string[];    // 避けたい時間の要約 (例: ["水曜終日", "月曜午前"])
  mailPreference: string;       // メール方針の要約
  requiredInfos: string[];      // 必要な情報
}

/**
 * 3. 相手プロフィール解析AI (モック版)
 * 相手の自然文プロフィールから、予定調整のヒントやルール、メール方針を整理します。
 */
export function analyzeProfile(user: UserProfile): AnalyzedProfile {
  const preferredTimeHints: string[] = [];
  const avoidedTimeHints: string[] = [];

  // 自然文からキーワードを走査して構造化（モック的ロジック）
  const availText = user.availableTimesFreeText;
  const avoidText = user.avoidTimesFreeText;

  // 1. 会いやすい時間のパース
  if (availText.includes("金曜") && (availText.includes("午前") || availText.includes("9:00〜12:00"))) {
    preferredTimeHints.push("金曜日の午前中 (9:00〜12:00)");
  }
  if (availText.includes("木曜") && (availText.includes("午後") || availText.includes("13:00〜17:00"))) {
    preferredTimeHints.push("木曜日の午後 (13:00〜17:00)");
  }
  if (availText.includes("平日の窓口時間") || availText.includes("9:00〜17:00")) {
    preferredTimeHints.push("平日の昼間 (9:00〜17:00)");
  }
  if (availText.includes("月曜") && availText.includes("火曜") && availText.includes("16:30以降")) {
    preferredTimeHints.push("月曜・火曜の夕方 (16:30以降)");
  }
  if (availText.includes("土日")) {
    preferredTimeHints.push("土日のオンライン対応");
  }

  // デフォルト処理
  if (preferredTimeHints.length === 0 && availText) {
    preferredTimeHints.push(availText);
  }

  // 2. 避けたい時間のパース
  if (avoidText.includes("水曜") && (avoidText.includes("終日") || avoidText.includes("避けて"))) {
    avoidedTimeHints.push("水曜日の終日 (学内会議等)");
  }
  if (avoidText.includes("月曜") && avoidText.includes("午前")) {
    avoidedTimeHints.push("月曜日の午前中 (週次ミーティング)");
  }
  if (avoidText.includes("12:00〜13:00") || avoidText.includes("昼休み")) {
    avoidedTimeHints.push("平日の昼休み時間帯 (12:00〜13:00)");
  }
  if (avoidText.includes("水曜") && avoidText.includes("木曜") && avoidText.includes("避けて")) {
    avoidedTimeHints.push("水曜・木曜の終日 (研究準備優先)");
  }

  if (avoidedTimeHints.length === 0 && avoidText) {
    avoidedTimeHints.push(avoidText);
  }

  return {
    targetUserId: user.id,
    preferredTimeHints,
    avoidedTimeHints,
    mailPreference: user.mailPolicy,
    requiredInfos: user.mailRequiredInfo
  };
}
