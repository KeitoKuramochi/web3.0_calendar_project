import { UserProfile, TimeSlotScore } from "@/types";

/**
 * 4. 日程スコアリングAI (モック版)
 * 自分の空き時間（スロット）と、相手のプロフィール解析結果（会いやすい時間・NG時間）を突き合わせ、
 * 各日時スロットの調整可能性スコア (◎: excellent, ○: good, △: fair, ×: poor) を計算します。
 */
export function scoreTimeSlots(
  myAvailableSlots: string[],
  targetUser: UserProfile
): TimeSlotScore[] {
  return myAvailableSlots.map(slotStr => {
    // slotStrの例: "2026-05-29T10:00:00" (金曜)
    const date = new Date(slotStr);
    const dayOfWeek = date.getDay(); // 0: 日, 1: 月, ..., 6: 土
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeVal = hours * 100 + minutes; // 例: 10:30 -> 1030

    let score: "excellent" | "good" | "fair" | "poor" = "good";
    let privacyReason = "調整可能性に問題はありません。";

    // 曜日の日本語表現
    const daysJa = ["日", "月", "火", "水", "木", "金", "土"];
    const dayJa = daysJa[dayOfWeek];

    // 1. 絶対NGの判定
    // 土日NG
    if ((dayOfWeek === 0 || dayOfWeek === 6) && targetUser.absoluteNGTimes.some(ng => ng.includes("Saturday-All") || ng.includes("Sunday-All"))) {
      score = "poor";
      privacyReason = "相手の対応不可時間帯（休日）です。";
    }
    // 水曜NG (鈴木教授など)
    else if (dayOfWeek === 3 && targetUser.absoluteNGTimes.includes("Wednesday-All")) {
      score = "poor";
      privacyReason = "相手の対応不可曜日です。";
    }
    // 月曜午前NG (高橋准教授など)
    else if (dayOfWeek === 1 && timeVal < 1200 && targetUser.absoluteNGTimes.includes("Monday-Morning")) {
      score = "poor";
      privacyReason = "相手の対応不可時間帯（会議等）です。";
    }
    // 平日夜間NG (キャリアセンターなど)
    else if (dayOfWeek >= 1 && dayOfWeek <= 5 && timeVal >= 1700 && targetUser.absoluteNGTimes.includes("Weekday-Night")) {
      score = "poor";
      privacyReason = "窓口対応時間外です。";
    }
    // 水曜午前・木曜午前NG
    else if (dayOfWeek === 3 && timeVal < 1200 && targetUser.absoluteNGTimes.includes("Wednesday-Morning")) {
      score = "poor";
      privacyReason = "相手の対応不可時間帯です。";
    }
    else if (dayOfWeek === 4 && timeVal < 1200 && targetUser.absoluteNGTimes.includes("Thursday-Morning")) {
      score = "poor";
      privacyReason = "相手の対応不可時間帯です。";
    }

    // 2. 避けたい時間の判定 (絶対NGではないが、できれば避けたい。スコアは △: fair)
    if (score !== "poor") {
      const avoidText = targetUser.avoidTimesFreeText.toLowerCase();

      // 水曜避けたい (鈴木教授など、絶対NGではない場合)
      if (dayOfWeek === 3 && (avoidText.includes("水曜") || avoidText.includes("水曜日"))) {
        score = "fair";
        privacyReason = "相手の予定が詰まりやすい曜日（会議等）です。";
      }
      // 月曜午前避けたい
      else if (dayOfWeek === 1 && timeVal < 1200 && (avoidText.includes("月曜") && avoidText.includes("午前"))) {
        score = "fair";
        privacyReason = "相手の定例ミーティング時間帯と重なる可能性があります。";
      }
      // 昼休み避けたい (キャリアセンターなど)
      else if (timeVal >= 1200 && timeVal < 1300 && (avoidText.includes("12:00") || avoidText.includes("昼休み") || avoidText.includes("昼食"))) {
        score = "fair";
        privacyReason = "混雑が予想される時間帯、または休憩時間です。";
      }
      // 水・木避けたい（avoidTextに水曜・木曜両方含む場合）
      else if ((dayOfWeek === 3 || dayOfWeek === 4) && avoidText.includes("水曜") && avoidText.includes("木曜")) {
        score = "fair";
        privacyReason = "相手の研究活動のピーク時間と重なる可能性があります。";
      }
    }

    // 3. 会いやすい時間の判定 (スコアは ◎: excellent)
    if (score !== "poor" && score !== "fair") {
      const availText = targetUser.availableTimesFreeText.toLowerCase();

      // 金曜午前 (鈴木教授など)
      if (dayOfWeek === 5 && timeVal < 1200 && (availText.includes("金曜") && (availText.includes("午前") || availText.includes("9:00")))) {
        score = "excellent";
        privacyReason = "相手の優先面談枠（金曜午前）に合致しています。";
      }
      // 木曜午後 (高橋准教授など)
      else if (dayOfWeek === 4 && timeVal >= 1300 && timeVal < 1700 && (availText.includes("木曜") && (availText.includes("午後") || availText.includes("13:00")))) {
        score = "excellent";
        privacyReason = "相手の優先面談枠（木曜午後）に合致しています。";
      }
      // 平日昼間（availTextに9:00〜17:00 or 平日の窓口時間が含まれる場合）
      else if (dayOfWeek >= 1 && dayOfWeek <= 5 && timeVal >= 900 && timeVal < 1700 && (availText.includes("9:00〜17:00") || availText.includes("平日の窓口"))) {
        score = "excellent";
        privacyReason = "窓口の通常稼働時間帯です。";
      }
      // 月・火の夕方（availTextに月曜・火曜・16:30以降が含まれる場合）
      else if ((dayOfWeek === 1 || dayOfWeek === 2) && timeVal >= 1630 && availText.includes("月曜") && availText.includes("火曜") && availText.includes("16:30以降")) {
        score = "excellent";
        privacyReason = "相手の対応可能時間帯（放課後枠）に合致しています。";
      }
    }

    return {
      timeSlot: slotStr,
      score,
      privacyReason
    };
  });
}
