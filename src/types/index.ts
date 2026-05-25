// データモデル・型定義

// ロールは自由文字列（例: "学部生", "研究室教員", "TA", "サークル代表"）
export type UserRole = string

// 出力形式
export type OutputFormat = "email" | "slack" | "discord" | "line" | "short"

// 追加連絡先の種別
export type ContactType = "discord" | "slack" | "line" | "twitter" | "github" | "custom"

// 追加連絡先
export interface ContactMethod {
  type: ContactType
  label: string   // 表示名（例: "Discord", "研究室Slack"）
  value: string   // ID / ハンドル / URL（例: "@suzuki#1234", "suzuki_lab"）
}

// ユーザープロフィール
export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole               // 自由文字列のロール
  department: string           // 所属（学科・部署・研究室など、自由記述）
  bio?: string                 // 自由記述（学年・肩書き・その他何でも）
  publicIntro?: string         // 公開プロフィール用の自己紹介文
  avatar?: string
  topics: string[]             // 相談・対応可能な内容（タグ）
  customTopics?: string        // 追加の自由入力トピック
  contactMethods?: ContactMethod[]  // メール以外の連絡先
  availableTimesFreeText: string
  avoidTimesFreeText: string
  absoluteNGTimes: string[]
  mailPolicy: string
  mailRequiredInfo: string[]
  customMailRequiredInfo?: string // 追加の自由入力
  generalNotes?: string
}

// 相談相手の情報（役職推論に使用）
export interface RecipientInfo {
  name?: string
  role?: string
  department?: string
  notes?: string
}

// 相談リクエスト
export interface ConsultRequest {
  id: string
  requesterId: string
  targetUserId?: string
  title: string
  duration: number
  format: "offline" | "online" | "hybrid"
  myAvailableTimes: string[]
  freeTextInput: string
  urgency: "high" | "normal" | "low"
  consultTopics?: string[]     // 相談トピックタグ
  customConsultTopic?: string  // 自由入力トピック
  recipient?: RecipientInfo    // 相談相手の情報（役職推論用）
  isFirstContact?: boolean     // 初回連絡かどうか（冒頭文切り替え用）
}

// 日程調整候補
export interface TimeSlotScore {
  timeSlot: string
  score: "excellent" | "good" | "fair" | "poor"
  privacyReason: string
}

// メール/出力生成結果
export interface MailOutput {
  subject: string
  body: string
}

// メールチェック指摘事項
export interface MailIssue {
  type: "warning" | "error"
  message: string
  suggestion?: string
  searchText?: string  // 本文中でハイライトすべき文字列
}

// メールチェック結果
export interface MailCheckResult {
  passed: boolean
  issues: MailIssue[]
}

// 入力汲み取りAIのパース結果
export interface ParsedRequest {
  extractedTitle: string
  extractedDuration: number
  extractedFormat: "offline" | "online" | "hybrid"
  extractedUrgency: "high" | "normal" | "low"
  extractedKeywords: string[]
}

// 相談の進捗ステータス
export type ConsultationStatus = "draft" | "matched" | "composed" | "sent" | "waiting" | "confirmed" | "rescheduling"

// マッチング結果
export interface ConsultationMatch {
  targetUserId: string
  selectedTimeSlots: string[]
  selectedTimeSlotsRaw: string[]
  selectedTimeSlot: string
  inferredProfile?: UserProfile  // 役職推論で生成したプロフィール
}

// メール/メッセージ生成結果
export interface ConsultationMail {
  subject: string
  body: string
  format: OutputFormat
}

// 相談記録（ダッシュボードで管理する単位）
export interface ConsultationRecord {
  id: string
  status: ConsultationStatus
  createdAt: string
  updatedAt: string
  request?: ConsultRequest
  match?: ConsultationMatch
  mail?: ConsultationMail
  scheduleToken?: string      // 確定リンク用トークン
  confirmedSlot?: string      // 受信者が選んだ日時
  recipientNote?: string      // 受信者が「全部合わない」時に入力した代替候補
  recipientName?: string      // 受信者が入力した名前・ニックネーム
  recipientContact?: string   // 受信者が入力した連絡先（Discord名・メールなど）
  senderDisplayName?: string  // 確定リンクで表示する送信者名
}
