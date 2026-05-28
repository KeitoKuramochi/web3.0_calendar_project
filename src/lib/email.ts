import { Resend } from "resend"

const FROM = process.env.RESEND_FROM ?? "SyncMatch AI <onboarding@resend.dev>"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export async function sendConfirmedNotification({
  toEmail,
  toName,
  title,
  confirmedSlot,
  recipientName,
  recipientContact,
}: {
  toEmail: string
  toName: string
  title: string
  confirmedSlot: string
  recipientName?: string
  recipientContact?: string
}) {
  const resend = getResend()
  if (!resend) return

  const contactLine = [recipientName, recipientContact].filter(Boolean).join(" / ")

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `【日程確定】${title}`,
    text: [
      `${toName}さん`,
      "",
      `「${title}」の日程が確定しました。`,
      "",
      `■ 確定日時`,
      confirmedSlot,
      "",
      contactLine ? `■ 相手の情報\n${contactLine}` : "",
      "",
      `ダッシュボードで確認: ${APP_URL}/`,
    ].filter(l => l !== undefined).join("\n"),
  })
}

export async function sendReschedulingNotification({
  toEmail,
  toName,
  title,
  recipientNote,
}: {
  toEmail: string
  toName: string
  title: string
  recipientNote: string
}) {
  const resend = getResend()
  if (!resend) return

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `【要確認】${title} の日程について再調整のご要望`,
    text: [
      `${toName}さん`,
      "",
      `「${title}」について、候補日時がすべて都合がつかないとのご連絡がありました。`,
      "",
      `■ 相手からのメッセージ`,
      recipientNote,
      "",
      `新しい候補日時を設定する: ${APP_URL}/`,
    ].join("\n"),
  })
}
