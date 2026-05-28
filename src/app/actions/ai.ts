"use server"

import { anthropic } from "@/lib/anthropic"
import {
  UserProfile, TimeSlotScore, MailOutput, MailCheckResult, MailIssue, OutputFormat,
} from "@/types"
import { inferProfileFromRole } from "@/lib/ai/inferrer"
import { scoreTimeSlots } from "@/lib/ai/scorer"
import { generateEmail } from "@/lib/ai/mailGen"
import { checkEmail } from "@/lib/ai/mailCheck"

// ─── Feature 1: 相手プロフィール推論 + 時間スロットスコアリング ──────────────────

export async function analyzeRecipient(
  name: string,
  role: string,
  dept: string,
  notes: string,
  timeSlots: string[],
  duration: number
): Promise<{ profile: UserProfile; scores: TimeSlotScore[] }> {
  // フォールバック: APIキー未設定時はモックを使用
  if (!anthropic) {
    const profile = inferProfileFromRole(name, role, dept, notes)
    const scores = scoreTimeSlots(timeSlots, profile)
    return { profile, scores }
  }

  const slotsText = timeSlots
    .map((s) => {
      const d = new Date(s)
      const days = ["日", "月", "火", "水", "木", "金", "土"]
      return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    })
    .join("\n")

  const prompt = `あなたは大学でのスケジュール調整をサポートするAIです。
以下の相談相手の情報をもとに、その人の「スケジュール傾向」を推測し、各候補日時のスコアを判定してください。

## 相手の情報
- 名前: ${name || "（未入力）"}
- 役割・役職: ${role || "（未入力）"}
- 所属・学科: ${dept || "（未入力）"}
- メモ: ${notes || "（なし）"}

## 候補日時一覧（所要時間: ${duration}分）
${slotsText}

## 返答フォーマット（JSON のみ返答してください）
{
  "preferredTimeHints": ["対応しやすい時間帯の説明（2〜4項目）"],
  "avoidedTimeHints": ["避けた方が良い時間帯の説明（1〜3項目）"],
  "mailRequiredInfo": ["メールに書くべき情報（例: 学籍番号, 相談テーマ）"],
  "mailPolicy": "メール連絡に関する方針の1文",
  "slots": [
    {
      "timeSlot": "元の候補日時（ISO 8601形式: ${timeSlots[0] ?? "YYYY-MM-DDTHH:MM"}）",
      "score": "excellent|good|fair|poor",
      "reason": "スコアの理由（20文字以内）"
    }
  ]
}

判断基準:
- excellent: 役職・一般的な行動パターンから見て非常に対応しやすそう
- good: まずまず対応しやすそう
- fair: やや難しい可能性がある
- poor: 対応が難しい可能性が高い（月曜朝、昼休み、深夜など）`

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("JSON not found in response")
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
    // パース失敗時はフォールバック
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
  // フォールバック: APIキー未設定時はモックを使用
  if (!anthropic) {
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
    email: "丁寧なビジネスメール形式。件名あり。冒頭の挨拶・本文・結びの署名を含む。",
    slack: "Slackメッセージ形式。簡潔でインフォーマル。*太字* 記法を使用可。",
    discord: "Discordメッセージ形式。ラフで親しみやすい口調。**太字** や絵文字を適度に使用。",
    line: "LINEメッセージ形式。短く読みやすい。過度な絵文字は避ける。",
    short: "1〜2文で完結する極短文。要点のみ。",
  }

  const honorific = targetUser.role.includes("教員") || targetUser.role.includes("教授") || targetUser.role.includes("先生") ? "先生" : "様"
  const contactType = isRescheduling ? "再調整の連絡" : isFirstContact ? "初めての連絡" : "2回目以降の連絡"

  const scheduleSection = scheduleUrl
    ? `\n\n日程確定リンク（このURLから相手が都合の良い日時を選べます）:\n${scheduleUrl}`
    : ""

  const prompt = `あなたは大学生が目上の方・先生・先輩などに送る${outputFormat === "email" ? "メール" : "メッセージ"}を作成するAIです。

## 送信者情報
- 名前: ${requester.name}
- 所属: ${requester.department}
- メールアドレス: ${requester.email || "（未設定）"}

## 宛先情報
- 名前: ${targetUser.name}（${honorific}）
- 役割: ${targetUser.role}
- 所属: ${targetUser.department}

## 相談内容
- タイトル: ${title}
- 形式: ${formatJa}
- 補足説明: ${extraText || "（なし）"}

## 候補日時
${slotsText}${scheduleSection}

## 連絡の種類
${contactType}${isRescheduling && recipientNote ? `\n相手からの返信内容: 「${recipientNote}」` : ""}

## 形式・スタイル指定
${styleGuide[outputFormat]}

## 相手が求める情報（必ず含めること）
${targetUser.mailRequiredInfo.length > 0 ? targetUser.mailRequiredInfo.join(", ") : "特になし"}
${targetUser.mailRequiredInfo.includes("学籍番号") ? "※学籍番号は「（あなたの学籍番号）」というプレースホルダーで記載してください" : ""}

## 返答フォーマット（JSON のみ返答してください）
${outputFormat === "email" ? `{
  "subject": "件名テキスト",
  "body": "本文テキスト（改行は \\n を使用）"
}` : `{
  "subject": "",
  "body": "メッセージ本文（改行は \\n を使用）"
}`}

自然で読みやすい日本語で作成してください。`

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("JSON not found in response")
    const data = JSON.parse(jsonMatch[0])

    return {
      subject: data.subject ?? "",
      body: data.body ?? "",
    }
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

  // フォールバック: APIキー未設定時は既存チェックのみ
  if (!anthropic) return quickCheck

  const formatJa: Record<OutputFormat, string> = {
    email: "ビジネスメール",
    slack: "Slackメッセージ",
    discord: "Discordメッセージ",
    line: "LINEメッセージ",
    short: "短文メッセージ",
  }

  const prompt = `あなたは日本語のコミュニケーション校正AIです。
以下の${formatJa[outputFormat]}を厳しくチェックして、改善点を指摘してください。

## 送信者
- 名前: ${requester.name}
- 所属: ${requester.department}

## 宛先
- 名前: ${targetUser.name}
- 役割: ${targetUser.role}（${targetUser.role.includes("教員") || targetUser.role.includes("教授") ? "目上の方" : "関係者"}）

${subject ? `## 件名\n${subject}\n` : ""}
## 本文
${body}

## チェック項目
1. 敬語・言い回しの適切さ（役職に対して失礼な表現がないか）
2. 必要情報の漏れ: ${targetUser.mailRequiredInfo.length > 0 ? targetUser.mailRequiredInfo.join(", ") : "特になし"}
3. 文体がフォーマット（${formatJa[outputFormat]}）に合っているか
4. 読み手に不快感を与える表現がないか
5. 過度に長い・回りくどい表現がないか

## 返答フォーマット（JSON のみ返答してください）
{
  "issues": [
    {
      "type": "error|warning",
      "message": "指摘内容（30文字以内）",
      "suggestion": "修正案（40文字以内）",
      "searchText": "本文中の該当テキスト（省略可）"
    }
  ]
}

問題がない場合は "issues": [] を返してください。`

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("JSON not found in response")
    const data = JSON.parse(jsonMatch[0])

    const aiIssues: MailIssue[] = (data.issues as MailIssue[]).filter(
      (i) => i.type === "error" || i.type === "warning"
    )

    // 即時チェック + AI チェックを統合（重複を除去）
    const combined = [...quickCheck.issues]
    for (const ai of aiIssues) {
      const isDuplicate = combined.some((q) => q.message === ai.message)
      if (!isDuplicate) combined.push(ai)
    }

    return {
      passed: combined.filter((i) => i.type === "error").length === 0,
      issues: combined,
    }
  } catch {
    return quickCheck
  }
}
