import { UserProfile } from "@/types"

const ROLE_PATTERNS: {
  keywords: string[]
  availableTimesFreeText: string
  avoidTimesFreeText: string
  absoluteNGTimes: string[]
  mailRequiredInfo: string[]
  mailPolicy: string
}[] = [
  {
    keywords: ["教授", "准教授", "講師", "教員", "先生"],
    availableTimesFreeText: "木曜日の午後（13:00〜17:00）と金曜日の午前中（9:00〜12:00）が比較的対応しやすい傾向があります。",
    avoidTimesFreeText: "水曜日は終日講義や会議が入りやすい傾向があります。月曜日の午前も週次ミーティングのため避けていただけると幸いです。",
    absoluteNGTimes: ["Saturday-All", "Sunday-All", "Monday-Morning"],
    mailRequiredInfo: ["学籍番号", "氏名", "相談したい具体的なテーマ"],
    mailPolicy: "事前にメールでご連絡いただき、相談テーマと所属をお知らせください。",
  },
  {
    keywords: ["TA", "大学院生", "修士", "博士", "研究生"],
    availableTimesFreeText: "月曜日と火曜日の16:30以降は比較的対応可能です。土日もオンラインで対応できます。",
    avoidTimesFreeText: "水曜日と木曜日は研究準備で忙しいため、できれば避けていただけると幸いです。",
    absoluteNGTimes: ["Wednesday-Morning", "Thursday-Morning"],
    mailRequiredInfo: ["氏名", "講義名"],
    mailPolicy: "気軽に声をかけてください。件名に【相談】と入れてもらえると助かります。",
  },
  {
    keywords: ["職員", "事務", "キャリア", "スタッフ", "センター", "支援"],
    availableTimesFreeText: "平日の窓口時間（9:00〜17:00）が基本的な対応時間です。",
    avoidTimesFreeText: "昼休み（12:00〜13:00）は窓口が閉まっています。",
    absoluteNGTimes: ["Saturday-All", "Sunday-All", "Weekday-Night"],
    mailRequiredInfo: ["学籍番号", "氏名"],
    mailPolicy: "窓口またはメールにてご予約の上お越しください。",
  },
  {
    keywords: ["先輩", "同期", "同学年", "友人", "友達", "学部生"],
    availableTimesFreeText: "比較的フレキシブルに対応できます。",
    avoidTimesFreeText: "試験期間前後は忙しいことがあります。",
    absoluteNGTimes: [],
    mailRequiredInfo: [],
    mailPolicy: "気軽に連絡してください。",
  },
]

const DEFAULT_PATTERN = {
  availableTimesFreeText: "平日の昼間が比較的対応しやすい傾向があります。",
  avoidTimesFreeText: "週末や夜間は対応が難しい場合があります。",
  absoluteNGTimes: ["Saturday-All", "Sunday-All"],
  mailRequiredInfo: [],
  mailPolicy: "事前にご連絡ください。",
}

export function inferProfileFromRole(
  name: string,
  role: string,
  department: string,
  notes: string
): UserProfile {
  const roleText = `${role} ${department} ${notes}`.toLowerCase()

  const matched = ROLE_PATTERNS.find((p) =>
    p.keywords.some((k) => roleText.includes(k.toLowerCase()))
  )

  const pattern = matched ?? DEFAULT_PATTERN

  return {
    id: `inferred_${Date.now()}`,
    name: name || "（相手）",
    email: "",
    role: role || "（役割未入力）",
    department: department || "",
    topics: [],
    availableTimesFreeText: pattern.availableTimesFreeText,
    avoidTimesFreeText: pattern.avoidTimesFreeText,
    absoluteNGTimes: pattern.absoluteNGTimes,
    mailPolicy: pattern.mailPolicy,
    mailRequiredInfo: pattern.mailRequiredInfo,
    generalNotes: notes || "",
  }
}
