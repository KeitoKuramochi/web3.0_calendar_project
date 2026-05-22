import { UserProfile, MailOutput, OutputFormat } from "@/types"

/**
 * 6. メール/メッセージ生成AI (モック版)
 * 選択された日時・相談内容・相手プロフィール・出力フォーマットに応じた連絡文を生成します。
 */
export function generateEmail(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  selectedTimeSlots: string | string[],
  format: "offline" | "online" | "hybrid",
  extraText: string,
  outputFormat: OutputFormat = "email"
): MailOutput {
  // 複数スロットを配列で扱う
  const slots = Array.isArray(selectedTimeSlots) ? selectedTimeSlots : [selectedTimeSlots]

  switch (outputFormat) {
    case "slack":
      return generateSlack(requester, targetUser, title, slots, format)
    case "discord":
      return generateDiscord(requester, targetUser, title, slots, format)
    case "line":
      return generateLine(requester, targetUser, title, slots)
    case "short":
      return generateShort(requester, targetUser, title, slots)
    default:
      return generateFormalEmail(requester, targetUser, title, slots, format, extraText)
  }
}

function generateFormalEmail(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[],
  format: "offline" | "online" | "hybrid",
  extraText: string
): MailOutput {
  const formatJa =
    format === "offline"
      ? "対面での面談"
      : format === "online"
      ? "オンライン（Zoom等）での面談"
      : "面談（対面・オンラインいずれでも可）"

  const honorific = targetUser.role.includes("教員") || targetUser.role.includes("准教授") || targetUser.role.includes("教授") ? "先生" : "様"
  const targetNameWithTitle = `${targetUser.name}${honorific}`

  const subject = `【面談依頼】${title}について（${requester.department} ${requester.name}）`

  let body = ""
  body += `${targetUser.department}\n`
  body += `${targetNameWithTitle}\n\n`
  body += `突然のご連絡にて失礼いたします。\n`
  body += `${requester.department}の${requester.name}と申します。\n\n`
  body += `本日は、${title}についてご相談したく、メールいたしました。\n`
  if (extraText) {
    body += `\n（相談の詳細・背景）\n${extraText}\n\n`
  } else {
    body += `つきましては、お忙しいところ大変恐縮ですが、個別にお時間をいただくことは可能でしょうか。\n\n`
  }

  body += `以下の日時にてご都合はいかがでしょうか。\n\n`
  body += `--------------------------------------------------\n`
  if (slots.length === 1) {
    body += `【希望日時】 ${slots[0]}\n`
  } else {
    body += `【候補日時】（いずれかご都合の良い日時をお知らせください）\n`
    slots.forEach((s, i) => {
      body += `  第${i + 1}希望: ${s}\n`
    })
  }
  body += `【希望形式】 ${formatJa}\n`
  if (format === "offline" && targetUser.generalNotes?.includes("研究室")) {
    body += `【面談場所】 ${targetUser.name.replace(/\s*(教授|准教授)/, "")}先生の研究室\n`
  }
  body += `--------------------------------------------------\n\n`

  if (targetUser.mailRequiredInfo.length > 0) {
    body += `ご指定のありました必要情報を以下に記載いたします。\n`
    body += `--------------------------------------------------\n`
    targetUser.mailRequiredInfo.forEach((info) => {
      if (info.includes("学籍番号")) {
        body += `・学籍番号: （ご自身の学籍番号を入力してください）\n`
      } else if (info.includes("氏名")) {
        body += `・氏名: ${requester.name}\n`
      } else if (info.includes("テーマ")) {
        body += `・相談テーマ: ${title}\n`
      } else {
        body += `・${info}: ＿＿＿＿＿＿\n`
      }
    })
    body += `--------------------------------------------------\n\n`
  }

  body += `上記日程でご都合が悪い場合は、大変お手数ですが、折り返しご都合の良い日時をご教示いただけますと幸いです。\n\n`
  body += `お忙しいところお手数をおかけいたしますが、ご検討のほどよろしくお願い申し上げます。\n\n`
  body += `--------------------------------------------------\n`
  body += `${requester.name}（${requester.email}）\n`
  body += `${requester.department}\n`
  body += `--------------------------------------------------\n`

  return { subject, body }
}

function generateSlack(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[],
  format: "offline" | "online" | "hybrid"
): MailOutput {
  const formatJa = format === "offline" ? "対面" : format === "online" ? "オンライン" : "対面/オンライン"
  const slotsText =
    slots.length === 1
      ? slots[0]
      : slots.map((s, i) => `第${i + 1}希望: ${s}`).join("\n")

  const body =
    `${targetUser.name}さん、お疲れ様です。${requester.name}（${requester.department}）です。\n\n` +
    `「${title}」についてご相談させてください。\n\n` +
    `*候補日時:*\n${slotsText}\n` +
    `*形式:* ${formatJa}\n\n` +
    `ご都合はいかがでしょうか？よろしくお願いします！`

  return { subject: "", body }
}

function generateDiscord(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[],
  format: "offline" | "online" | "hybrid"
): MailOutput {
  const formatJa = format === "offline" ? "対面" : format === "online" ? "オンライン" : "どちらでも"
  const slotsText = slots.map((s, i) => `> ${i + 1}. ${s}`).join("\n")

  const body =
    `@${targetUser.name} こんにちは！${requester.name}です🙌\n\n` +
    `**${title}** について相談させてもらいたいです！\n\n` +
    `**候補日時:**\n${slotsText}\n` +
    `**形式:** ${formatJa}\n\n` +
    `都合いい日時あったら教えてください〜！よろしくお願いします！`

  return { subject: "", body }
}

function generateLine(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[]
): MailOutput {
  const slotsText =
    slots.length === 1
      ? slots[0]
      : slots.map((s, i) => `・${s}`).join("\n")

  const body =
    `${targetUser.name}さん、こんにちは！\n` +
    `${requester.name}です。\n\n` +
    `「${title}」について相談させていただきたいのですが、` +
    `以下の日時はご都合いかがでしょうか？\n\n` +
    `${slotsText}\n\n` +
    `よろしくお願いします！`

  return { subject: "", body }
}

function generateShort(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[]
): MailOutput {
  const slotsText =
    slots.length === 1
      ? slots[0]
      : slots.map((s) => s).join(" / ")

  const body =
    `${requester.name}（${requester.department}）です。` +
    `「${title}」の件でご相談があります。` +
    `【候補】${slotsText} はご都合いかがでしょうか？`

  return { subject: "", body }
}
