import { UserProfile, MailOutput } from "@/types";

/**
 * 6. メール生成AI (モック版)
 * 選択された日時、相談内容、相手のプロフィールおよびメール方針を踏まえて、
 * 丁寧で失礼のない日程調整・面談依頼のメールを作成します。
 */
export function generateEmail(
  requester: UserProfile,       // 申請者 (学生)
  targetUser: UserProfile,      // 相談相手 (教員・職員)
  title: string,                // 相談内容のタイトル
  selectedTimeSlot: string,    // 決定した時間 (フォーマット済みの文字列 "5月29日(金) 10:00〜10:30")
  format: "offline" | "online" | "hybrid",
  extraText: string             // 追加コメント
): MailOutput {
  // 形式の日本語表現
  const formatJa = format === "offline" ? "対面での面談" : format === "online" ? "オンライン（Zoom等）での面談" : "面談（対面・オンラインいずれでも可）";

  // 相手の役割に応じた敬称の決定
  const honorific = targetUser.role === "professor" ? "先生" : "様";
  const targetNameWithTitle = `${targetUser.name}${honorific}`;

  // 件名の決定
  const subject = `【面談依頼】${title}について（${requester.department} ${requester.name}）`;

  // 本文の組み立て
  let body = "";

  // 1. 宛先
  body += `${targetUser.department}\n`;
  body += `${targetNameWithTitle}\n\n`;

  // 2. 自己紹介
  body += `突然のご連絡にて失礼いたします。\n`;
  body += `${requester.department}の${requester.name}と申します。\n\n`;

  // 3. 相談の目的と理由
  body += `本日は、${title}についてご相談したく、メールいたしました。\n`;
  if (extraText) {
    body += `（相談の詳細・背景）\n${extraText}\n\n`;
  } else {
    body += `つきましては、お忙しいところ大変恐縮ですが、個別にお時間をいただくことは可能でしょうか。\n\n`;
  }

  // 4. 提案日時と形式
  body += `SyncMatch AIにて日程調整を行いましたところ、以下の日時が調整可能として提示されました。\n`;
  body += `よろしければ、この時間帯にてご都合いかがでしょうか。\n\n`;
  body += `--------------------------------------------------\n`;
  body += `【希望日時】 ${selectedTimeSlot}\n`;
  body += `【希望形式】 ${formatJa}\n`;
  if (format === "offline" && targetUser.generalNotes?.includes("研究室")) {
    body += `【面談場所】 ${targetUser.name}先生の研究室\n`;
  }
  body += `--------------------------------------------------\n\n`;

  // 5. 相手がメールに入れてほしい情報のチェックと挿入
  if (targetUser.mailRequiredInfo.length > 0) {
    body += `なお、ご指定のありました必要情報を以下に記載いたします。\n`;
    body += `--------------------------------------------------\n`;
    targetUser.mailRequiredInfo.forEach(info => {
      if (info.includes("学籍番号")) {
        body += `・学籍番号: (ご自身の学籍番号を入力してください)\n`;
      } else if (info.includes("氏名")) {
        body += `・氏名: ${requester.name}\n`;
      } else if (info.includes("テーマ")) {
        body += `・相談テーマ: ${title}\n`;
      } else {
        body += `・${info}: ＿＿＿＿＿＿\n`;
      }
    });
    body += `--------------------------------------------------\n\n`;
  }

  // 6. 結びの言葉
  body += `上記日程でご都合が悪い場合は、大変お手数ですが、折り返しご都合の良い日時をご教示いただけますと幸いです。\n\n`;
  body += `お忙しいところ手数をおかけいたしますが、ご検討のほどよろしくお願い申し上げます。\n\n`;

  // 7. 署名
  body += `--------------------------------------------------\n`;
  body += `${requester.name} (${requester.email})\n`;
  body += `${requester.department}\n`;
  body += `--------------------------------------------------\n`;

  return {
    subject,
    body
  };
}
