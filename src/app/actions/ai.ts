"use server"

import { hasCloudflareAI, callCloudflareAI } from "@/lib/cloudflare-ai"
import {
  UserProfile, TimeSlotScore, MailOutput, MailCheckResult, MailIssue, OutputFormat,
} from "@/types"
import { inferProfileFromRole } from "@/lib/ai/inferrer"
import { scoreTimeSlots } from "@/lib/ai/scorer"
import { generateEmail } from "@/lib/ai/mailGen"
import { checkEmail } from "@/lib/ai/mailCheck"

// 品質重視モデル（メール生成・チェック）
const MODEL_QUALITY = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
// 速度重視モデル（スコアリング）
const MODEL_FAST = "@cf/meta/llama-3.1-8b-instruct"

// ─── Feature 1: 相手プロフィール推論 + 時間スロットスコアリング ──────────────────

export async function analyzeRecipient(
  name: string,
  role: string,
  dept: string,
  notes: string,
  timeSlots: string[],
  duration: number
): Promise<{ profile: UserProfile; scores: TimeSlotScore[] }> {
  // フォールバック: 認証情報未設定時はモックを使用
  if (!hasCloudflareAI) {
    const profile = inferProfileFromRole(name, role, dept, notes)
    const scores = scoreTimeSlots(timeSlots, profile)
    return { profile, scores }
  }

  const slotsText = timeSlots
    .map((s) => {
      const d = new Date(s)
      const days = ["日", "月", "火", "水", "木", "金", "土"]
      return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} timeSlot:${s}`
    })
    .join("\n")

  const prompt = `You are an AI that helps Japanese university students schedule meetings.
Analyze the recipient's information and predict their schedule tendencies.
Respond ONLY with valid JSON, no other text.

Recipient:
- Name: ${name || "(unknown)"}
- Role: ${role || "(unknown)"}
- Department: ${dept || "(unknown)"}
- Notes: ${notes || "(none)"}

Time slots to score (duration: ${duration} min):
${slotsText}

Scoring criteria:
- excellent: very likely available (e.g. mid-morning on weekdays)
- good: probably available
- fair: might be busy (e.g. Monday morning meetings)
- poor: likely unavailable (e.g. lunch break, late night, Sunday)

Return this exact JSON structure:
{
  "preferredTimeHints": ["time range description in Japanese", "..."],
  "avoidedTimeHints": ["time range to avoid in Japanese", "..."],
  "mailRequiredInfo": ["info needed in email in Japanese e.g. 学籍番号"],
  "mailPolicy": "one sentence about email policy in Japanese",
  "slots": [
    {
      "timeSlot": "ISO8601 string from input e.g. ${timeSlots[0] ?? "2025-06-01T10:00"}",
      "score": "excellent|good|fair|poor",
      "reason": "reason in Japanese under 20 chars"
    }
  ]
}`

  try {
    const text = await callCloudflareAI(MODEL_FAST, [{ role: "user", content: prompt }])
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("JSON not found")
    const data = JSON.parse(jsonMatch[0])

    const profile: UserProfile = {
      id: `inferred_${Date.now()}`,
      name: name || "（相手）",
      email: "",
      role: role || "",
      department: dept || "",
      topics: [],
      availableTimesFreeText: (data.preferredTimeHints as string[]).join("。"),
      avoidTimesFreeText: (data.avoidedTimeHints as string[]).join("。"),
      absoluteNGTimes: [],
      mailPolicy: data.mailPolicy ?? "",
      mailRequiredInfo: Array.isArray(data.mailRequiredInfo) ? data.mailRequiredInfo : [],
      generalNotes: notes,
    }

    const scores: TimeSlotScore[] = (data.slots as { timeSlot: string; score: string; reason: string }[]).map((s) => ({
      timeSlot: s.timeSlot,
      score: (["excellent", "good", "fair", "poor"].includes(s.score) ? s.score : "fair") as TimeSlotScore["score"],
      privacyReason: s.reason ?? "",
    }))

    return { profile, scores }
  } catch {
    const profile = inferProfileFromRole(name, role, dept, notes)
    const scores = scoreTimeSlots(timeSlots, profile)
    return { profile, scores }
  }
}

// ─── Feature 2: メッセージ生成 ────────────────────────────────────────────────

export async function generateMail(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[],
  format: "offline" | "online" | "hybrid",
  extraText: string,
  outputFormat: OutputFormat,
  scheduleUrl?: string,
  isFirstContact?: boolean,
  isRescheduling?: boolean,
  recipientNote?: string
): Promise<MailOutput> {
  if (!hasCloudflareAI) {
    return generateEmail(
      requester, targetUser, title, slots, format, extraText,
      outputFormat, scheduleUrl, isFirstContact ?? true, isRescheduling ?? false, recipientNote
    )
  }

  const formatJa = format === "offline" ? "対面" : format === "online" ? "オンライン" : "対面/オンラインどちらでも"
  const slotsText = slots.length === 1
    ? `希望日時: ${slots[0]}`
    : slots.map((s, i) => `第${i + 1}希望: ${s}`).join("\n")

  const styleGuide: Record<OutputFormat, string> = {
    email: "丁寧なビジネスメール。件名と本文を含む。冒頭挨拶・本文・結びの署名を含める。",
    slack: "Slackメッセージ。簡潔でインフォーマル。*太字* 記法可。",
    discord: "Discordメッセージ。ラフな口調。**太字** と絵文字を適度に使う。",
    line: "LINEメッセージ。短く読みやすい。",
    short: "1〜2文の極短文。要点のみ。",
  }

  const honorific = targetUser.role.includes("教員") || targetUser.role.includes("教授") || targetUser.role.includes("先生") ? "先生" : "様"
  const contactType = isRescheduling
    ? `再調整の連絡${recipientNote ? `（相手の返信:「${recipientNote}」）` : ""}`
    : isFirstContact ? "初めての連絡" : "2回目以降の連絡"

  const scheduleSection = scheduleUrl
    ? `\n\n日程確定リンク（このURLから相手が日時を選べます）:\n${scheduleUrl}`
    : ""

  const requiredInfoSection = targetUser.mailRequiredInfo.length > 0
    ? `\n必ず含める情報: ${targetUser.mailRequiredInfo.join(", ")}${targetUser.mailRequiredInfo.includes("学籍番号") ? "\n※学籍番号は「（あなたの学籍番号）」と記載" : ""}`
    : ""

  const prompt = `あなたは日本語のメッセージ作成AIです。以下の条件で${outputFormat === "email" ? "メール" : "メッセージ"}を作成してください。
JSONのみ返答してください。

送信者: ${requester.name}（${requester.department}）
宛先: ${targetUser.name}${honorific}（${targetUser.role}、${targetUser.department}）
相談タイトル: ${title}
形式: ${formatJa}
補足: ${extraText || "なし"}
候補日時:
${slotsText}${scheduleSection}
連絡種別: ${contactType}
スタイル: ${styleGuide[outputFormat]}${requiredInfoSection}

${outputFormat === "email"
    ? `{"subject":"件名","body":"本文（改行は\\nを使用）"}`
    : `{"subject":"","body":"メッセージ本文（改行は\\nを使用）"}`
  }`

  try {
    const text = await callCloudflareAI(MODEL_QUALITY, [{ role: "user", content: prompt }])
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("JSON not found")
    const data = JSON.parse(jsonMatch[0])
    return { subject: data.subject ?? "", body: data.body ?? "" }
  } catch {
    return generateEmail(
      requester, targetUser, title, slots, format, extraText,
      outputFormat, scheduleUrl, isFirstContact ?? true, isRescheduling ?? false, recipientNote
    )
  }
}

// ─── Feature 3: AIによるメール深層チェック ────────────────────────────────────

export async function checkMailWithAI(
  body: string,
  subject: string,
  targetUser: UserProfile,
  requester: UserProfile,
  outputFormat: OutputFormat
): Promise<MailCheckResult> {
  // まず既存の即時チェック（正規表現）を実行
  const quickCheck = checkEmail(body, targetUser)

  if (!hasCloudflareAI) return quickCheck

  const formatJa: Record<OutputFormat, string> = {
    email: "ビジネスメール", slack: "Slackメッセージ",
    discord: "Discordメッセージ", line: "LINEメッセージ", short: "短文",
  }

  const prompt = `日本語のコミュニケーション校正AIです。以下の${formatJa[outputFormat]}をチェックして改善点をJSONで返してください。

送信者: ${requester.name}（${requester.department}）
宛先: ${targetUser.name}（${targetUser.role}）
${subject ? `件名: ${subject}\n` : ""}本文:
${body}

チェック項目:
1. 敬語・丁寧さ（役職に対して失礼な表現がないか）
2. 必要情報の漏れ: ${targetUser.mailRequiredInfo.length > 0 ? targetUser.mailRequiredInfo.join(", ") : "特になし"}
3. ${formatJa[outputFormat]}として文体が適切か
4. 不快感を与える表現がないか

問題がなければ issues を空配列で返す。
{"issues":[{"type":"error|warning","message":"指摘内容30文字以内","suggestion":"修正案40文字以内","searchText":"本文中の該当テキスト（なければ省略）"}]}`

  try {
    const text = await callCloudflareAI(MODEL_QUALITY, [{ role: "user", content: prompt }])
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("JSON not found")
    const data = JSON.parse(jsonMatch[0])

    const aiIssues: MailIssue[] = (data.issues as MailIssue[]).filter(
      (i) => i.type === "error" || i.type === "warning"
    )

    // 即時チェック + AI チェックを統合（重複除去）
    const combined = [...quickCheck.issues]
    for (const ai of aiIssues) {
      if (!combined.some((q) => q.message === ai.message)) combined.push(ai)
    }

    return { passed: combined.filter((i) => i.type === "error").length === 0, issues: combined }
  } catch {
    return quickCheck
  }
}
