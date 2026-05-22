import { UserProfile } from "@/types";
import { DUMMY_USERS } from "../dummyData";

export interface SelectorCandidate {
  user: UserProfile;
  matchScore: number; // 0 - 100
  reason: string;     // 推薦理由
}

/**
 * 2. 相談先選定AI (モック版)
 * 相手未指定時、相談リクエストのキーワードや自由文から、
 * 最適な相談先候補（教員、キャリアセンターなど）を提案します。
 */
export function selectCandidates(
  keywords: string[],
  freeText: string
): SelectorCandidate[] {
  const candidates = DUMMY_USERS.filter(user => user.role !== "student");
  const result: SelectorCandidate[] = [];

  const textToAnalyze = (keywords.join(" ") + " " + freeText).toLowerCase();

  candidates.forEach(user => {
    let score = 0;
    const matchedTopics: string[] = [];

    // 1. トピックの直接マッチング (1つあたり30点)
    user.topics.forEach(topic => {
      if (textToAnalyze.includes(topic.toLowerCase())) {
        score += 30;
        matchedTopics.push(topic);
      }
    });

    // 2. 役割や属性による追加マッチング
    // キャリア/進路系
    if (user.id === "office_career" && (textToAnalyze.includes("就活") || textToAnalyze.includes("インターン") || textToAnalyze.includes("履歴書") || textToAnalyze.includes("企業") || textToAnalyze.includes("進路"))) {
      score += 40;
      if (!matchedTopics.includes("進路相談")) matchedTopics.push("進路・就職支援");
    }
    // プログラミング/課題系
    if (user.id === "ta_tanaka" && (textToAnalyze.includes("プログラミング") || textToAnalyze.includes("コード") || textToAnalyze.includes("エラー") || textToAnalyze.includes("課題") || textToAnalyze.includes("c言語") || textToAnalyze.includes("python"))) {
      score += 40;
      if (!matchedTopics.includes("プログラミング質問")) matchedTopics.push("プログラミング・課題サポート");
    }
    // 研究室/ゼミ系
    if ((user.id === "prof_suzuki" || user.id === "prof_takahashi") && (textToAnalyze.includes("研究室") || textToAnalyze.includes("ゼミ") || textToAnalyze.includes("卒論"))) {
      score += 35;
      if (!matchedTopics.includes("研究室選び")) matchedTopics.push("研究室紹介・配属");
    }

    // デフォルトで少しの下駄を履かせる (最低適合度10%)
    score = Math.min(100, Math.max(10, score));

    // 推薦理由の生成
    let reason = "";
    if (matchedTopics.length > 0) {
      reason = `対応可能な相談内容「${matchedTopics.slice(0, 2).join(", ")}」がご希望のテーマと合致しています。`;
    } else {
      reason = `関連分野（${user.department}）の担当窓口・教員として対応可能です。`;
    }

    // キャリアセンター固有の理由追加
    if (user.id === "office_career" && textToAnalyze.includes("就活")) {
      reason = "就職活動や履歴書添削、面接対策の専門窓口です。";
    }
    // TA固有の理由追加
    if (user.id === "ta_tanaka" && textToAnalyze.includes("課題")) {
      reason = "大学院生TAが授業の課題やプログラミングの質問に分かりやすく答えます。";
    }

    result.push({
      user,
      matchScore: score,
      reason
    });
  });

  // スコアの降順でソート
  return result.sort((a, b) => b.matchScore - a.matchScore);
}
