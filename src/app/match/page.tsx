"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, CalendarDays, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck, Mail } from "lucide-react";
import styles from "./match.module.css";
import { selectCandidates, scoreTimeSlots, analyzeProfile } from "@/lib/ai";
import { DUMMY_USERS } from "@/lib/dummyData";
import { ConsultRequest, UserProfile, TimeSlotScore } from "@/types";

export default function MatchPage() {
  const router = useRouter();

  // ステート
  const [request, setRequest] = useState<ConsultRequest | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [analyzedProfile, setAnalyzedProfile] = useState<any>(null);
  const [scoredSlots, setScoredSlots] = useState<TimeSlotScore[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  // 1. リクエスト情報のロードと相談先マッチング
  useEffect(() => {
    let reqData: ConsultRequest;
    const savedReq = localStorage.getItem("consult_request");

    if (savedReq) {
      try {
        reqData = JSON.parse(savedReq) as ConsultRequest;
      } catch (e) {
        reqData = getDefaultRequest();
      }
    } else {
      reqData = getDefaultRequest();
      localStorage.setItem("consult_request", JSON.stringify(reqData));
    }
    setRequest(reqData);

    // キーワード抽出から相談先マッチング候補を算出
    const keywords = reqData.title ? [reqData.title] : ["研究室選び"];
    const textToMatch = reqData.freeTextInput || "";
    const matchedCandidates = selectCandidates(keywords, textToMatch);
    setCandidates(matchedCandidates);

    // 初期値として最もマッチ度の高い相手を選択
    if (matchedCandidates.length > 0) {
      handleSelectCandidate(matchedCandidates[0].user.id, reqData);
    }
  }, []);

  const getDefaultRequest = (): ConsultRequest => {
    return {
      id: "req_default",
      requesterId: "student_1",
      title: "研究室選びに関する相談",
      duration: 30,
      format: "offline",
      myAvailableTimes: [
        "2026-05-29T10:00", // 金曜午前 (鈴木教授◎)
        "2026-05-29T11:00", // 金曜午前 (鈴木教授◎)
        "2026-05-27T10:00", // 水曜午前 (鈴木教授NG)
        "2026-05-28T14:00"  // 木曜午後 (高橋准教授◎)
      ],
      freeTextInput: "来週鈴木先生の研究室についてお聞きしたいです。金曜午前が空いています。対面希望です。",
      urgency: "normal"
    };
  };

  // 相談先選択時の処理
  const handleSelectCandidate = (userId: string, currentReq = request) => {
    setSelectedCandidateId(userId);
    setSelectedSlot(""); // スロット選択をクリア

    const user = DUMMY_USERS.find(u => u.id === userId);
    if (!user || !currentReq) return;

    // A. 相手プロフィールのAI解析
    const parsedProfile = analyzeProfile(user);
    setAnalyzedProfile(parsedProfile);

    // B. 日程スコアリングAI
    const scores = scoreTimeSlots(currentReq.myAvailableTimes, user);
    setScoredSlots(scores);
  };

  // 日時の読みやすい日本語変換
  const formatTimeSlotJa = (slotStr: string) => {
    const d = new Date(slotStr);
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // スコア絵文字の取得
  const getScoreEmoji = (score: string) => {
    switch (score) {
      case "excellent": return "◎";
      case "good": return "○";
      case "fair": return "△";
      case "poor": return "×";
      default: return "-";
    }
  };

  // スコアバッジクラスの取得
  const getScoreBadgeClass = (score: string) => {
    switch (score) {
      case "excellent": return `${styles.scoreBadge} ${styles.scoreExcellent}`;
      case "good": return `${styles.scoreBadge} ${styles.scoreGood}`;
      case "fair": return `${styles.scoreBadge} ${styles.scoreFair}`;
      case "poor": return `${styles.scoreBadge} ${styles.scorePoor}`;
      default: return styles.scoreBadge;
    }
  };

  // 次へ進む (メール生成へ)
  const handleNext = () => {
    if (!selectedCandidateId || !selectedSlot) return;

    const matchData = {
      targetUserId: selectedCandidateId,
      selectedTimeSlot: formatTimeSlotJa(selectedSlot),
      selectedTimeSlotRaw: selectedSlot
    };

    localStorage.setItem("consult_match", JSON.stringify(matchData));
    router.push("/mail");
  };

  const selectedUser = DUMMY_USERS.find(u => u.id === selectedCandidateId);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>相談先マッチング・日程調整</h1>
        <p>AIがリクエスト内容に適した相談先を提案しました。相談相手を選択し、調整可能性の高い日時を決めてください。</p>
      </div>

      <div className={styles.layout}>
        {/* 左カラム：相談先候補 */}
        <div>
          <div className={styles.sectionTitle}>
            <Users size={18} />
            <span>相談先候補 (AI推奨順)</span>
          </div>

          <div className={styles.candidateList}>
            {candidates.map((cand) => (
              <div
                key={cand.user.id}
                className={`${styles.candidateCard} ${selectedCandidateId === cand.user.id ? styles.candidateCardActive : ""}`}
                onClick={() => handleSelectCandidate(cand.user.id)}
              >
                <span className={styles.matchBadge}>適合度 {cand.matchScore}%</span>
                <div className={styles.candidateHeader}>
                  <div className={styles.avatar}>{cand.user.avatar || "👤"}</div>
                  <div className={styles.candidateInfo}>
                    <h3>{cand.user.name}</h3>
                    <p>{cand.user.department}</p>
                  </div>
                </div>
                <div className={styles.recommendReason}>
                  {cand.reason}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右カラム：予定スコアリング＆プライバシーぼかし */}
        <div>
          {selectedUser && (
            <div className={styles.detailSection}>
              {/* プロフィール・ポリシーのAI分析 */}
              <div className="glass-card fade-in" style={{ padding: "20px" }}>
                <div className={styles.sectionTitle} style={{ marginBottom: "12px" }}>
                  <ShieldCheck size={18} style={{ color: "var(--color-secondary)" }} />
                  <span>相手の予定調整ルール (AI分析結果)</span>
                </div>

                <div className={styles.profileSummary}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>対応面談枠:</div>
                    <div className={styles.timeTagGroup}>
                      {analyzedProfile?.preferredTimeHints.map((hint: string) => (
                        <span key={hint} className={styles.timeTagPrefer}>{hint}</span>
                      ))}
                      {analyzedProfile?.preferredTimeHints.length === 0 && (
                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>特に指定なし</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>できれば避けたい時間:</div>
                    <div className={styles.timeTagGroup}>
                      {analyzedProfile?.avoidedTimeHints.map((hint: string) => (
                        <span key={hint} className={styles.timeTagAvoid}>{hint}</span>
                      ))}
                      {analyzedProfile?.avoidedTimeHints.length === 0 && (
                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>特に指定なし</span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: "10px", fontSize: "0.85rem", background: "rgba(255, 255, 255, 0.02)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                    <span style={{ fontWeight: "600", color: "var(--color-primary-light)" }}>メールに関する基本方針: </span>
                    <span style={{ color: "var(--text-secondary)" }}>{selectedUser.mailPolicy}</span>
                  </div>
                </div>
              </div>

              {/* 日程スコアリング */}
              <div className="glass-card fade-in" style={{ padding: "20px" }}>
                <div className={styles.sectionTitle} style={{ marginBottom: "8px" }}>
                  <CalendarDays size={18} />
                  <span>調整可能性の高い日時</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  相手の具体的なカレンダー予定は公開されません。調整可能性が「◎」「○」のスロットを選択してください。
                </p>

                <div className={styles.slotList}>
                  {scoredSlots.map((slot) => {
                    const isPoor = slot.score === "poor";
                    const isActive = selectedSlot === slot.timeSlot;

                    return (
                      <div
                        key={slot.timeSlot}
                        className={`${styles.slotItem} ${isActive ? styles.slotItemActive : ""}`}
                        style={{ cursor: isPoor ? "not-allowed" : "pointer", opacity: isPoor ? 0.6 : 1 }}
                        onClick={() => {
                          if (!isPoor) setSelectedSlot(slot.timeSlot);
                        }}
                      >
                        <div className={getScoreBadgeClass(slot.score)}>
                          {getScoreEmoji(slot.score)}
                        </div>
                        <div className={styles.slotInfo}>
                          <div className={styles.slotTime}>{formatTimeSlotJa(slot.timeSlot)}</div>
                          <div className={styles.slotReason}>{slot.privacyReason}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.footer}>
                  <button
                    onClick={handleNext}
                    className={styles.btnNext}
                    disabled={!selectedSlot}
                  >
                    選択した日時でメール作成へ進む
                    <Mail size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
