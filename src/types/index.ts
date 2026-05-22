// データモデル・型定義

export type UserRole = "student" | "professor" | "staff" | "ta";

// ユーザープロフィール (教員・学生・職員)
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;          // 学科・部署 (例: "情報工学科", "進路支援課")
  avatar?: string;             // アバター絵文字など
  topics: string[];            // 対応可能な相談内容 (例: "進路相談", "研究室選び", "履修登録")
  availableTimesFreeText: string; // 自由文での予定感 (例: "金曜午前は比較的空いています")
  avoidTimesFreeText: string;    // 避けてほしい時間 (例: "水曜は会議が多いため避けたい")
  absoluteNGTimes: string[];      // 絶対NG時間帯 (例: ["Wednesday-All", "Weekday-Night"])
  mailPolicy: string;           // メール方針 (例: "メールで済むならメールで")
  mailRequiredInfo: string[];   // メールに入れてほしい情報 (例: "学籍番号", "具体的な質問内容")
  generalNotes?: string;        // 自由記述（その他）
}

// 相談リクエスト
export interface ConsultRequest {
  id: string;
  requesterId: string;         // 申請者ID (学生)
  targetUserId?: string;       // 指定相手のユーザーID (未指定時はAI選定)
  title: string;               // 相談件名
  duration: number;            // 所要時間 (30, 60分など)
  format: "offline" | "online" | "hybrid"; // 対面かオンラインか
  myAvailableTimes: string[];   // 自分の空き時間 (例: ["2026-05-29T10:00:00Z"])
  freeTextInput: string;       // 自由文入力
  urgency: "high" | "normal" | "low";
}

// 日程調整候補
export interface TimeSlotScore {
  timeSlot: string;            // 日時 (ISO形式または表示用文字列 "2026-05-29T10:00:00Z")
  score: "excellent" | "good" | "fair" | "poor"; // ◎, ○, △, ×
  privacyReason: string;       // ぼかした表現 (例: 「相手の方針（午前中推奨）に合致しています」)
}

// メール生成結果
export interface MailOutput {
  subject: string;             // 件名
  body: string;                // 本文
}

// メールチェック指摘事項
export interface MailIssue {
  type: "warning" | "error";   // 警告レベル
  message: string;             // 指摘内容
  suggestion?: string;         // 修正提案
}

// メールチェック結果
export interface MailCheckResult {
  passed: boolean;
  issues: MailIssue[];
}

// 入力汲み取りAIのパース結果
export interface ParsedRequest {
  extractedTitle: string;
  extractedDuration: number;
  extractedFormat: "offline" | "online" | "hybrid";
  extractedUrgency: "high" | "normal" | "low";
  extractedKeywords: string[];
}
