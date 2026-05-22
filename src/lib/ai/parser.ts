import { ParsedRequest } from "@/types";
import { DUMMY_TOPICS } from "../dummyData";

/**
 * 1. 入力汲み取りAI (モック版)
 * ユーザーが入力した自由文から、相談内容・希望時期・空き時間・重要度などを抽出します。
 */
export function parseFreeText(text: string): ParsedRequest {
  if (!text) {
    return {
      extractedTitle: "",
      extractedDuration: 30,
      extractedFormat: "hybrid",
      extractedUrgency: "normal",
      extractedKeywords: []
    };
  }

  // 1. 所要時間の抽出 (例: 30分, 1時間, 60分)
  let duration = 30;
  if (text.includes("30分")) {
    duration = 30;
  } else if (text.includes("60分") || text.includes("1時間") || text.includes("60分")) {
    duration = 60;
  } else if (text.includes("90分") || text.includes("1時間半")) {
    duration = 90;
  } else if (text.includes("15分")) {
    duration = 15;
  }

  // 2. 形式の抽出 (対面, オンライン, Zoom)
  let format: "offline" | "online" | "hybrid" = "hybrid";
  if (text.match(/(対面|直接|オフィス|会って)/)) {
    format = "offline";
  } else if (text.match(/(オンライン|zoom|meet|teams|遠隔)/i)) {
    format = "online";
  }

  // 3. 急ぎ度
  let urgency: "high" | "normal" | "low" = "normal";
  if (text.match(/(急ぎ|至急|すぐに|大至急|できるだけ早く|困って)/)) {
    urgency = "high";
  } else if (text.match(/(急がない|いつでも|暇な時|いつでもいい)/)) {
    urgency = "low";
  }

  // 4. キーワード抽出 (ダミーのトピックリストから合致するものを探す)
  const keywords: string[] = [];
  DUMMY_TOPICS.forEach(topic => {
    if (text.includes(topic) || (topic === "進路相談" && text.includes("進路"))) {
      keywords.push(topic);
    }
  });

  // もしキーワードに「就職活動」や「履歴書添削」があり「進路相談」がない場合は追加
  if (text.includes("就職") || text.includes("面接") || text.includes("履歴書")) {
    if (!keywords.includes("就職活動")) keywords.push("就職活動");
  }
  if (text.includes("研究室") || text.includes("ゼミ")) {
    if (!keywords.includes("研究室選び")) keywords.push("研究室選び");
  }
  if (text.includes("プログラミング") || text.includes("コード") || text.includes("課題")) {
    if (!keywords.includes("プログラミング質問")) keywords.push("プログラミング質問");
  }

  // 5. 相談タイトルの自動生成
  let title = "";
  if (keywords.length > 0) {
    title = `${keywords[0]}に関する面談`;
  } else {
    // 自由文の最初の15文字を切り取る
    const cleanText = text.replace(/[\n\r]/g, " ").trim();
    title = cleanText.length > 15 ? `${cleanText.substring(0, 15)}...` : cleanText;
  }

  return {
    extractedTitle: title,
    extractedDuration: duration,
    extractedFormat: format,
    extractedUrgency: urgency,
    extractedKeywords: keywords.length > 0 ? keywords : ["その他"]
  };
}
