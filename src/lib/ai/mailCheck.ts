import { UserProfile, MailCheckResult, MailIssue } from "@/types";

/**
 * 7. メールチェックAI (モック版)
 * 生成・編集されたメール文面を解析し、相手の指定した「必須情報」が不足していないか、
 * また学生から教員等へのメールとして「失礼な表現」がないかをチェックします。
 */
export function checkEmail(
  body: string,
  targetUser: UserProfile
): MailCheckResult {
  const issues: MailIssue[] = [];

  // 1. テンプレートプレースホルダーの残存チェック
  if (body.includes("(ご自身の学籍番号を入力してください)") || body.includes("（ご自身の学籍番号を入力してください）")) {
    issues.push({
      type: "error",
      message: "「学籍番号」がプレースホルダーのままになっています。",
      suggestion: "ご自身の学籍番号（例: 22JK101）に書き換えてください。"
    });
  }
  if (body.includes("＿＿＿＿＿＿")) {
    issues.push({
      type: "error",
      message: "未記入の必要項目（＿＿＿＿＿＿）が存在します。",
      suggestion: "指定された内容を入力してください。"
    });
  }

  // 2. 相手が必要とする情報のキーワードチェック (プレースホルダーを消した場合の確認)
  targetUser.mailRequiredInfo.forEach(info => {
    if (info.includes("学籍番号")) {
      const hasStudentId = /[0-9]{2,4}[A-Za-z]{1,4}[0-9]{3,4}/.test(body) || body.toLowerCase().includes("学籍") || body.includes("番号");
      if (!hasStudentId) {
        issues.push({
          type: "warning",
          message: "相手が求める「学籍番号」の記載が見当たりません。",
          suggestion: "署名や本文中に学籍番号を記載することをおすすめします。"
        });
      }
    }
  });

  // 3. 不適切なカジュアル表現・失礼な表現のチェック
  const impoliteChecks = [
    {
      pattern: /(暇な時間|暇なとき|あいてる時間)/,
      message: "「暇な時間」という表現は目上の方に対して失礼です。",
      suggestion: "「ご都合の良い時間」「お時間のある際」などに変更してください。"
    },
    {
      pattern: /(お時間ありますか|時間ある？)/,
      message: "「お時間ありますか」はややフランクすぎる印象を与えます。",
      suggestion: "「お時間をいただくことは可能でしょうか」「ご都合はいかがでしょうか」などに変更してください。"
    },
    {
      pattern: /(よろしく！|よろしくおねがい|お願いしますー)/,
      message: "文末の表現が崩れすぎています。",
      suggestion: "「よろしくお願い申し上げます」「何卒よろしくお願いいたします」に修正してください。"
    },
    {
      pattern: /(至急|すぐにでも|即答)/,
      message: "相手に返信を強要するような強い表現が含まれています。",
      suggestion: "「お忙しいところ恐縮ですが」「可能な限り早めにご対応いただけますと幸いです」などのクッション言葉を挟んでください。"
    },
    {
      pattern: /(対面でお願いします|対面がいいです)/,
      message: "面談形式を強く一方的に指定する表現は避けるべきです。",
      suggestion: "「できれば対面での面談を希望いたしますが、ご都合がつかない場合はオンラインでも問題ありません」などの配慮を加えてください。"
    }
  ];

  impoliteChecks.forEach(check => {
    if (check.pattern.test(body)) {
      issues.push({
        type: "warning",
        message: check.message,
        suggestion: check.suggestion
      });
    }
  });

  return {
    passed: issues.filter(i => i.type === "error").length === 0,
    issues
  };
}
