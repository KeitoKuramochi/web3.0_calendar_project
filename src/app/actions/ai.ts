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
): Promise<{ profile: UserProfile; scores: TimeSlotScore[]; reasoningFactors: string[]; workPattern: string; aiComment: string; usedMock: boolean }> {
  // フォールバック: 認証情報未設定時はモックを使用
  if (!hasCloudflareAI) {
    const profile = inferProfileFromRole(name, role, dept, notes)
    const scores = scoreTimeSlots(timeSlots, profile)
    const reasoningFactors = role
      ? [`${role}の傾向を参考に推測`, dept ? `${dept}の業務パターンを参照` : ""].filter(Boolean)
      : ["入力情報から一般的な傾向を推測"]
    return { profile, scores, reasoningFactors, workPattern: "", aiComment: "", usedMock: true }
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
- excellent: very likely available (e.g. mid-morning weekdays)
- good: probably available
- fair: might be busy (e.g. Monday mornings, lunch)
- poor: likely unavailable (e.g. Saturday, Sunday, late night)

IMPORTANT RULES:
- Use specific Japanese weekday names (月曜日, 火曜日, 水曜日, 木曜日, 金曜日, 土曜日, 日曜日) — never say "出勤前日" or vague relative terms.
- Infer typical work patterns from the role (e.g. 教員 → 平日勤務・土日祝休み, 医師 → シフト勤務, etc.).
- If you cannot confidently infer the pattern, explain in aiComment what is unclear.
- workPattern: one concise sentence about likely weekly schedule (e.g. "平日（月〜金）勤務、土日祝は休み").
- aiComment: honest note if uncertain or if slot scoring has caveats (≤40 chars, Japanese). Empty string if no issues.

Return this exact JSON structure:
{
  "workPattern": "平日（月〜金）勤務、土日祝は休み",
  "aiComment": "役職から推測。個人差あり。",
  "reasoningFactors": ["根拠1（≤20文字）", "根拠2"],
  "preferredTimeHints": ["水曜日・木曜日の午前中", "火曜午後"],
  "avoidedTimeHints": ["土曜日・日曜日", "月曜日の午前（会議が多い傾向）"],
  "mailRequiredInfo": ["info needed in email in Japanese e.g. 学籍番号"],
  "mailPolicy": "one sentence about email policy in Japanese",
  "slots": [
    {
      "timeSlot": "ISO8601 string from input e.g. ${timeSlots[0] ?? "2025-06-01T10:00"}",
      "score": "excellent|good|fair|poor",
      "reason": "reason using specific weekday, ≤20 chars Japanese"
    }
  ]
}
STRICT LIMITS: preferredTimeHints/avoidedTimeHints max 4 items each, ≤25 chars per item; reasoningFactors max 3 items, ≤20 chars each.`

  try {
    // スロット数に応じてトークン上限を調整（スロット1件≒80トークン）
    const neededTokens = Math.max(1024, 512 + timeSlots.length * 100)
    const text = await callCloudflareAI(MODEL_FAST, [{ role: "user", content: prompt }], neededTokens)
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

    const reasoningFactors: string[] = Array.isArray(data.reasoningFactors)
      ? (data.reasoningFactors as string[]).slice(0, 3)
      : []
    const workPattern: string = data.workPattern ?? ""
    const aiComment: string = data.aiComment ?? ""
    return { profile, scores, reasoningFactors, workPattern, aiComment, usedMock: false }
  } catch (err) {
    console.error("[analyzeRecipient] AI failed, using mock fallback:", err)
    const profile = inferProfileFromRole(name, role, dept, notes)
    const scores = scoreTimeSlots(timeSlots, profile)
    const reasoningFactors = role
      ? [`${role}の傾向を参考に推測`, dept ? `${dept}の業務パターンを参照` : ""].filter(Boolean)
      : ["入力情報から一般的な傾向を推測"]
    return { profile, scores, reasoningFactors, workPattern: "", aiComment: "", usedMock: true }
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
  recipientNote?: string,
  userInstruction?: string
): Promise<MailOutput> {
  if (!hasCloudflareAI) {
    return generateEmail(
      requester, targetUser, title, slots, format, extraText,
      outputFormat, scheduleUrl, isFirstContact ?? true, isRescheduling ?? false, recipientNote
    )
  }

  const formatJa = format === "offline" ? "対面" : format === "online" ? "オンライン" : "対面/オンラインどちらでも"

  const schedulingSection = scheduleUrl
    ? `日程確定リンク（このURLから相手が日時を選ぶ。メール本文には具体的な日時を列挙せずリンクのみ案内）:\n${scheduleUrl}`
    : slots.length === 1
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

  const requiredInfoSection = targetUser.mailRequiredInfo.length > 0
    ? `\n必ず含める情報: ${targetUser.mailRequiredInfo.join(", ")}${targetUser.mailRequiredInfo.includes("学籍番号") ? "\n※学籍番号は「（あなたの学籍番号）」と記載" : ""}`
    : ""

  const instructionSection = userInstruction
    ? `\n追加指示（最優先で反映してください）: ${userInstruction}`
    : ""

  const prompt = `あなたは日本語のメッセージ作成AIです。以下の条件で${outputFormat === "email" ? "メール" : "メッセージ"}を作成してください。
JSONのみ返答してください。

送信者: ${requester.name}（${requester.department}）
宛先: ${targetUser.name}${honorific}（${targetUser.role}、${targetUser.department}）
相談タイトル: ${title}
形式: ${formatJa}
補足: ${extraText || "なし"}
日程情報:
${schedulingSection}
連絡種別: ${contactType}
スタイル: ${styleGuide[outputFormat]}${requiredInfoSection}${instructionSection}

${outputFormat === "email"
    ? `{"subject":"件名","body":"本文（改行は\\nを使用）"}`
    : `{"subject":"","body":"メッセージ本文（改行は\\nを使用）"}`
  }`

  try {
    const text = await callCloudflareAI(MODEL_QUALITY, [{ role: "user", content: prompt }], 2048)
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

チェック項目（errorとwarningを区別してください）:

【error：必ず修正が必要なもの】
- 「（あなたの学籍番号）」「（お名前）」など未入力のプレースホルダーが残っている
- 必要情報の欠落: ${targetUser.mailRequiredInfo.length > 0 ? targetUser.mailRequiredInfo.join(", ") : "特になし"}
- 明らかに失礼・不適切な表現

【warning：確認推奨だが必須ではないもの】
- 敬語が若干カジュアルすぎる・堅すぎる
- ${formatJa[outputFormat]}としてやや文体が合っていない
- 曖昧な表現で誤解を招く可能性がある
- 確認したほうが安心な箇所（例：日時表記の曖昧さ、形式の指定）

問題がなければ issues を空配列で返す。searchText は本文中の該当テキストそのものを指定（クリックでカーソルが飛ぶ）。
{"issues":[{"type":"error|warning","message":"指摘内容30文字以内","suggestion":"修正案40文字以内","searchText":"本文中の該当テキスト（なければ省略）"}]}`

  try {
    const text = await callCloudflareAI(MODEL_QUALITY, [{ role: "user", content: prompt }], 1024)
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
  } catch (err) {
    console.error("[checkMailWithAI] AI check failed, using static fallback:", err)
    return quickCheck
  }
}
