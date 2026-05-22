"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, ShieldCheck, AlertCircle, CheckCircle2, Copy, PartyPopper, Check, HelpCircle } from "lucide-react";
import styles from "./mail.module.css";
import { generateEmail, checkEmail } from "@/lib/ai";
import { DUMMY_USERS } from "@/lib/dummyData";
import { ConsultRequest, UserProfile, MailCheckResult, MailIssue } from "@/types";

export default function MailPage() {
  const router = useRouter();

  // ステート
  const [requester, setRequester] = useState<UserProfile | null>(null);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [request, setRequest] = useState<ConsultRequest | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [checkResult, setCheckResult] = useState<MailCheckResult>({ passed: true, issues: [] });
  
  const [showToast, setShowToast] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 1. 各種ローカルデータのロードとメール初期生成
  useEffect(() => {
    // 送信者 (ログインユーザー) のロード
    let sender: UserProfile;
    const savedProfile = localStorage.getItem("user_profile");
    if (savedProfile) {
      try { sender = JSON.parse(savedProfile); } catch (e) { sender = getDefaultSender(); }
    } else {
      sender = getDefaultSender();
    }
    setRequester(sender);

    // 相談リクエストのロード
    let req: ConsultRequest;
    const savedReq = localStorage.getItem("consult_request");
    if (savedReq) {
      try { req = JSON.parse(savedReq); } catch (e) { req = getDefaultRequest(); }
    } else {
      req = getDefaultRequest();
    }
    setRequest(req);

    // マッチング結果のロード
    let match: any;
    const savedMatch = localStorage.getItem("consult_match");
    if (savedMatch) {
      try { match = JSON.parse(savedMatch); } catch (e) { match = getDefaultMatch(); }
    } else {
      match = getDefaultMatch();
    }
    setMatchData(match);

    // 相手のロード
    const foundTarget = DUMMY_USERS.find(u => u.id === match.targetUserId) || DUMMY_USERS[1];
    setTargetUser(foundTarget);

    // メール自動生成の実行
    const generated = generateEmail(
      sender,
      foundTarget,
      req.title || "ご相談",
      match.selectedTimeSlot || "5月29日(金) 10:00〜10:30",
      req.format || "offline",
      req.freeTextInput || ""
    );

    setSubject(generated.subject);
    setBody(generated.body);

    // 初回チェック
    const check = checkEmail(generated.body, foundTarget);
    setCheckResult(check);
  }, []);

  // メール本文編集時のハンドラ (リアルタイムでAIチェックを走らせる)
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    if (targetUser) {
      const check = checkEmail(val, targetUser);
      setCheckResult(check);
    }
  };

  const getDefaultSender = (): UserProfile => ({
    id: "student_1",
    name: "佐藤 拓海",
    email: "sato.takumi@univ.ac.jp",
    role: "student",
    department: "情報工学科3年",
    avatar: "👨‍🎓",
    topics: ["研究室選び"],
    availableTimesFreeText: "",
    avoidTimesFreeText: "",
    absoluteNGTimes: [],
    mailPolicy: "",
    mailRequiredInfo: []
  });

  const getDefaultRequest = (): ConsultRequest => ({
    id: "req_default",
    requesterId: "student_1",
    title: "研究室選びに関する相談",
    duration: 30,
    format: "offline",
    myAvailableTimes: [],
    freeTextInput: "",
    urgency: "normal"
  });

  const getDefaultMatch = () => ({
    targetUserId: "prof_suzuki",
    selectedTimeSlot: "5月29日(金) 10:00〜10:30",
    selectedTimeSlotRaw: "2026-05-29T10:00:00"
  });

  // メール本文のコピー
  const handleCopy = () => {
    const emailFullText = `件名: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(emailFullText).then(() => {
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        // コピー完了後にサクセスモーダルを表示
        setShowSuccessModal(true);
      }, 1500);
    });
  };

  // ダッシュボードへ戻る (履歴保存は今回はデモなのでリセット)
  const handleGoDashboard = () => {
    // 進行中のリクエスト情報を削除してダッシュボードへ
    localStorage.removeItem("consult_request");
    localStorage.removeItem("consult_match");
    router.push("/");
  };

  const errors = checkResult.issues.filter(i => i.type === "error");
  const warnings = checkResult.issues.filter(i => i.type === "warning");
  const hasIssues = checkResult.issues.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>メール下書き生成・検証</h1>
        <p>AIが相手の連絡方針や必要要件を満たしたメール文を作成しました。内容を確認・編集し、チェック結果を参考にしてください。</p>
      </div>

      <div className={styles.layout}>
        {/* 左カラム：メール編集 */}
        <div>
          <div className={styles.sectionTitle}>
            <Mail size={18} />
            <span>生成された面談依頼メール (直接編集可)</span>
          </div>

          <div className={styles.mailEditor}>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={styles.subjectInput}
              placeholder="件名"
            />
            <textarea
              value={body}
              onChange={handleBodyChange}
              className={styles.bodyTextarea}
              placeholder="本文"
            />
            
            <div className={styles.editorFooter}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                ※コピーして、お手持ちのメーラー（Outlook等）に貼り付けて送信してください。
              </span>
              <button 
                onClick={handleCopy} 
                className={styles.btnCopy}
                disabled={errors.length > 0}
                style={{ opacity: errors.length > 0 ? 0.6 : 1, cursor: errors.length > 0 ? "not-allowed" : "pointer" }}
              >
                <Copy size={16} />
                コピーして完了する
              </button>
            </div>
          </div>
        </div>

        {/* 右カラム：チェック結果 */}
        <div>
          <div className={styles.checkerSidebar}>
            
            {/* ステータスカード */}
            <div className={`${styles.checkStatusCard} glass-card`}>
              <div className={styles.sectionTitle} style={{ marginBottom: "12px" }}>
                <ShieldCheck size={18} style={{ color: "var(--color-secondary)" }} />
                <span>メールチェックAI</span>
              </div>

              {errors.length > 0 ? (
                <div className={`${styles.checkStatusHeader} styles.statusFailed`} style={{ color: "var(--color-danger)" }}>
                  <AlertCircle size={20} />
                  <span>未解決のエラーがあります</span>
                </div>
              ) : warnings.length > 0 ? (
                <div className={`${styles.checkStatusHeader} styles.statusWarning`} style={{ color: "var(--color-fair)" }}>
                  <AlertCircle size={20} />
                  <span>改善可能な警告があります</span>
                </div>
              ) : (
                <div className={`${styles.checkStatusHeader} styles.statusPassed`} style={{ color: "var(--color-excellent)" }}>
                  <CheckCircle2 size={20} />
                  <span>送信可能な状態です！</span>
                </div>
              )}

              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                {errors.length > 0 
                  ? "赤色の必須エラー項目を修正するまで、コピー機能はロックされます。" 
                  : "警告項目は任意ですが、修正すると相手へより丁寧な印象を与えられます。"}
              </p>

              {/* 指摘事項リスト */}
              <div className={styles.issueList}>
                {checkResult.issues.map((issue, idx) => {
                  const isError = issue.type === "error";
                  
                  return (
                    <div 
                      key={idx} 
                      className={`${styles.issueItem} ${isError ? styles.issueError : styles.issueWarning}`}
                    >
                      <div className={`${styles.issueTitle} ${isError ? styles.issueTitleError : styles.issueTitleWarning}`}>
                        <AlertCircle size={14} />
                        <span>{isError ? "必須入力エラー" : "表現の警告"}</span>
                      </div>
                      <div className={styles.issueMessage}>{issue.message}</div>
                      {issue.suggestion && (
                        <div className={styles.issueSuggestion}>
                          <span style={{ color: "var(--color-primary-light)", marginRight: "4px" }}>【修正案】</span>
                          {issue.suggestion}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!hasIssues && (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    🎉 指摘事項はありません。このまま安心して送信できます。
                  </div>
                )}
              </div>
            </div>

            {/* 調整相手のメール情報ガイド */}
            {targetUser && (
              <div className="glass-card" style={{ padding: "16px" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <HelpCircle size={14} style={{ color: "var(--color-primary-light)" }} />
                  {targetUser.name}先生の指定条件:
                </div>
                <ul style={{ fontSize: "0.8rem", color: "var(--text-secondary)", paddingLeft: "16px" }}>
                  {targetUser.mailRequiredInfo.map((info, idx) => (
                    <li key={idx} style={{ marginBottom: "4px" }}>{info}</li>
                  ))}
                  {targetUser.mailRequiredInfo.length === 0 && <li>特になし</li>}
                </ul>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* コピートースト */}
      {showToast && (
        <div className={styles.toast}>
          <Check size={18} />
          <span>メール文面をクリップボードにコピーしました！</span>
        </div>
      )}

      {/* 完了モーダル */}
      {showSuccessModal && (
        <div className={styles.successOverlay}>
          <div className={`${styles.successCard} glass-card`}>
            <div className={styles.successIcon}>
              <PartyPopper size={36} />
            </div>
            <h2>日程調整メールの準備完了！</h2>
            <p>
              {targetUser?.name}との「{request?.title}」の日程調整メールが作成され、コピーされました。
            </p>
            <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "14px", borderRadius: "10px", width: "100%", fontSize: "0.85rem", border: "1px solid var(--border-color)", textAlign: "left" }}>
              <div style={{ fontWeight: "600", color: "var(--color-secondary)" }}>次のステップ:</div>
              <ol style={{ paddingLeft: "16px", marginTop: "6px", color: "var(--text-secondary)" }}>
                <li>お使いの大学メールソフト（OutlookやGmail）を開きます。</li>
                <li>新規作成画面で本文入力欄に貼り付け（Ctrl+V または Cmd+V）を行います。</li>
                <li>宛先に <b>{targetUser?.email}</b> を入力して送信します。</li>
              </ol>
            </div>
            <button onClick={handleGoDashboard} className={styles.btnDashboard}>
              ダッシュボードへ戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
