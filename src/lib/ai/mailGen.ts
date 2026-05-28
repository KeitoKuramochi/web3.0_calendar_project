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
  outputFormat: OutputFormat = "email",
  scheduleToken?: string,
  isFirstContact: boolean = true,
  isRescheduling: boolean = false,
  recipientNote?: string
): MailOutput {
  const slots = Array.isArray(selectedTimeSlots) ? selectedTimeSlots : [selectedTimeSlots]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const scheduleUrl = scheduleToken ? `${appUrl}/schedule/${scheduleToken}` : undefined

  switch (outputFormat) {
    case "slack":
      return generateSlack(requester, targetUser, title, slots, format, scheduleUrl, isFirstContact, isRescheduling, recipientNote)
    case "discord":
      return generateDiscord(requester, targetUser, title, slots, format, scheduleUrl, isFirstContact, isRescheduling, recipientNote)
    case "line":
      return generateLine(requester, targetUser, title, slots, scheduleUrl, isFirstContact, isRescheduling, recipientNote)
    case "short":
      return generateShort(requester, targetUser, title, slots, scheduleUrl, isFirstContact, isRescheduling)
    default:
      return generateFormalEmail(requester, targetUser, title, slots, format, extraText, scheduleUrl, isFirstContact, isRescheduling, recipientNote)
  }
}

function generateFormalEmail(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[],
  format: "offline" | "online" | "hybrid",
  extraText: string,
  scheduleUrl?: string,
  isFirstContact: boolean = true,
  isRescheduling: boolean = false,
  recipientNote?: string
): MailOutput {
  const formatJa =
    format === "offline"
      ? "対面での面談"
      : format === "online"
      ? "オンライン（Zoom等）での面談"
      : "面談（対面・オンラインいずれでも可）"

  const honorific = targetUser.role.includes("教員") || targetUser.role.includes("准教授") || targetUser.role.includes("教授") ? "先生" : "様"
  const targetNameWithTitle = `${targetUser.name}${honorific}`

  const subject = isRescheduling
    ? `【再調整】${title}について（${requester.department} ${requester.name}）`
    : `【面談依頼】${title}について（${requester.department} ${requester.name}）`

  let body = ""
  body += `${targetUser.department}\n`
  body += `${targetNameWithTitle}\n\n`
  if (isRescheduling) {
    body += `お世話になっております。\n`
    body += `${requester.department}の${requester.name}です。\n\n`
    body += `先日は日程のご都合が合わず、大変失礼いたしました。\n`
    if (recipientNote) {
      body += `ご返信いただいた内容（「${recipientNote}」）を確認の上、改めて日程をご提案させていただきます。\n\n`
    } else {
      body += `改めて日程をご提案させていただきます。\n\n`
    }
  } else if (isFirstContact) {
    body += `突然のご連絡にて失礼いたします。\n`
    body += `${requester.department}の${requester.name}と申します。\n\n`
  } else {
    body += `お世話になっております。\n`
    body += `${requester.department}の${requester.name}です。\n\n`
  }
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

  if (scheduleUrl) {
    body += `--------------------------------------------------\n`
    body += `■ ワンクリック日程確定リンク\n`
    body += `${scheduleUrl}\n`
    body += `上記リンクよりご都合の良い日時をお選びいただけます（アカウント登録不要）。\n`
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
  format: "offline" | "online" | "hybrid",
  scheduleUrl?: string,
  isFirstContact: boolean = true,
  isRescheduling: boolean = false,
  recipientNote?: string
): MailOutput {
  const formatJa = format === "offline" ? "対面" : format === "online" ? "オンライン" : "対面/オンライン"
  const slotsText =
    slots.length === 1
      ? slots[0]
      : slots.map((s, i) => `第${i + 1}希望: ${s}`).join("\n")

  let greeting = ""
  if (isRescheduling) {
    greeting = `${targetUser.name}さん、お疲れ様です。${requester.name}（${requester.department}）です。\n先日は日程が合わず失礼しました。改めて候補をご提案します。${recipientNote ? `\n（ご返信内容：「${recipientNote}」を踏まえて調整しました）` : ""}\n\n`
  } else {
    greeting = isFirstContact
      ? `${targetUser.name}さん、はじめまして。${requester.name}（${requester.department}）です。\n\n`
      : `${targetUser.name}さん、お疲れ様です。${requester.name}（${requester.department}）です。\n\n`
  }

  let body =
    greeting +
    `「${title}」についてご相談させてください。\n\n` +
    `*候補日時:*\n${slotsText}\n` +
    `*形式:* ${formatJa}\n\n`
  if (scheduleUrl) body += `*日程確定リンク:* ${scheduleUrl}\n\n`
  body += `ご都合はいかがでしょうか？よろしくお願いします！`

  return { subject: "", body }
}

function generateDiscord(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[],
  format: "offline" | "online" | "hybrid",
  scheduleUrl?: string,
  isFirstContact: boolean = true,
  isRescheduling: boolean = false,
  recipientNote?: string
): MailOutput {
  const formatJa = format === "offline" ? "対面" : format === "online" ? "オンライン" : "どちらでも"
  const slotsText = slots.map((s, i) => `> ${i + 1}. ${s}`).join("\n")

  let greeting = ""
  if (isRescheduling) {
    greeting = `@${targetUser.name} お疲れ様です！${requester.name}です🙌\n先日は日程が合わずごめんなさい🙏 改めて候補を出します！${recipientNote ? `\n（「${recipientNote}」とのこと、参考にしました）` : ""}\n\n`
  } else {
    greeting = isFirstContact
      ? `@${targetUser.name} はじめまして！${requester.name}です🙌\n\n`
      : `@${targetUser.name} お疲れ様です！${requester.name}です🙌\n\n`
  }

  let body =
    greeting +
    `**${title}** について相談させてもらいたいです！\n\n` +
    `**候補日時:**\n${slotsText}\n` +
    `**形式:** ${formatJa}\n\n`
  if (scheduleUrl) body += `**日程確定リンク:** ${scheduleUrl}\n\n`
  body += `都合いい日時あったら教えてください〜！よろしくお願いします！`

  return { subject: "", body }
}

function generateLine(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[],
  scheduleUrl?: string,
  isFirstContact: boolean = true,
  isRescheduling: boolean = false,
  recipientNote?: string
): MailOutput {
  const slotsText =
    slots.length === 1
      ? slots[0]
      : slots.map((s, i) => `・${s}`).join("\n")

  let intro = ""
  if (isRescheduling) {
    intro = `${targetUser.name}さん、こんにちは！\n${requester.name}です。\n\n先日は日程が合わず申し訳ありませんでした🙏${recipientNote ? `\n「${recipientNote}」とのご返信、ありがとうございます。` : ""}\n改めて候補日時をお伝えします。\n\n`
  } else {
    intro = isFirstContact
      ? `${targetUser.name}さん、はじめまして！\n${requester.name}といいます。\n\n`
      : `${targetUser.name}さん、こんにちは！\n${requester.name}です。\n\n`
  }

  let body =
    intro +
    `「${title}」について相談させていただきたいのですが、` +
    `以下の日時はご都合いかがでしょうか？\n\n` +
    `${slotsText}\n\n`
  if (scheduleUrl) body += `日程確定リンク: ${scheduleUrl}\n\n`
  body += `よろしくお願いします！`

  return { subject: "", body }
}

function generateShort(
  requester: UserProfile,
  targetUser: UserProfile,
  title: string,
  slots: string[],
  scheduleUrl?: string,
  isFirstContact: boolean = true,
  isRescheduling: boolean = false
): MailOutput {
  const slotsText =
    slots.length === 1
      ? slots[0]
      : slots.map((s) => s).join(" / ")

  let body = isRescheduling
    ? `${requester.name}（${requester.department}）です。先日は日程が合わず失礼しました。「${title}」の件で改めてご提案です。`
    : `${requester.name}（${requester.department}）です。「${title}」の件でご相談があります。`
  body += `【候補】${slotsText} はご都合いかがでしょうか？`
  if (scheduleUrl) body += ` 日程確定: ${scheduleUrl}`

  return { subject: "", body }
}
