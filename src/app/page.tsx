"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { User, CalendarPlus, CheckSquare, ArrowRight, Sparkles, Shield, Clock } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  const [hasRecentMatch, setHasRecentMatch] = useState(false);
  const [recentMatch, setRecentMatch] = useState<any>(null);

  useEffect(() => {
    // 直近で調整完了した案件があるか確認 (デモ体験用)
    const savedMatch = localStorage.getItem("consult_match");
    const savedReq = localStorage.getItem("consult_request");
    
    if (savedMatch && savedReq) {
      try {
        const match = JSON.parse(savedMatch);
        const req = JSON.parse(savedReq);
        setRecentMatch({ match, req });
        setHasRecentMatch(true);
      } catch (e) {
        console.error("Failed to parse recent match data", e);
      }
    }
  }, []);

  return (
    <div className={styles.container}>
      {/* ヒーローセクション */}
      <section className={styles.hero}>
        <h1>予定調整を、もっと優しくスマートに</h1>
        <p>
          曖昧な予定感やニュアンスを理解するAIが、相手のプライバシーを守りながら最適な面談日時を見つけ、失礼のないメール作成まで一気通貫で支援します。
        </p>
      </section>

      {/* クイックアクションカード */}
      <section className={styles.grid}>
        <Link href="/profile" className={`${styles.card} glass-card`}>
          <div className={styles.iconWrapper}>
            <User size={24} />
          </div>
          <h2>1. プロフィール設定</h2>
          <p>
            あなたの「会いやすい時間帯」「避けてほしい曜日」「メールの基本方針」などを登録・管理します。
          </p>
          <div className={styles.cardLink}>
            プロフィールを開く <ArrowRight size={16} />
          </div>
        </Link>

        <Link href="/request" className={`${styles.card} glass-card`}>
          <div className={`${styles.iconWrapper} ${styles.iconWrapperSecondary}`}>
            <CalendarPlus size={24} />
          </div>
          <h2>2. 相談リクエスト作成</h2>
          <p>
            「来週くらいに進路相談したい」といった自然な文章や詳細条件を入力し、AIが最適な相談先と日程を絞り込みます。
          </p>
          <div className={styles.cardLink}>
            相談予約を始める <ArrowRight size={16} />
          </div>
        </Link>
      </section>

      {/* タイムライン：調整ステータス */}
      <section className={styles.timelineSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className={styles.sectionTitle}>
            <Clock size={18} />
            <span>進行中の調整状況</span>
          </h2>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>※プロトタイプ用デモ履歴</span>
        </div>

        <div className={styles.timeline}>
          {/* ユーザーが実際にプロトタイプを動かして作成した直近のデータを上部に差し込む */}
          {hasRecentMatch && recentMatch && (
            <div className={styles.timelineItem} style={{ borderLeft: "4px solid var(--color-secondary)" }}>
              <div className={styles.timelineLeft}>
                <div className={styles.timelineAvatar} style={{ background: "rgba(6, 182, 212, 0.1)" }}>💬</div>
                <div className={styles.timelineInfo}>
                  <h4>{recentMatch.req.title} (調整中)</h4>
                  <p>相手: {recentMatch.match.targetUserId === "prof_suzuki" ? "鈴木 茂 教授" : "高橋 美咲 准教授"} | 確定時間: {recentMatch.match.selectedTimeSlot}</p>
                </div>
              </div>
              <span className={`${styles.statusBadge} ${styles.statusWait}`}>メール送信待ち</span>
            </div>
          )}

          <div className={styles.timelineItem}>
            <div className={styles.timelineLeft}>
              <div className={styles.timelineAvatar}>👨‍🏫</div>
              <div className={styles.timelineInfo}>
                <h4>研究室配属に関する面談</h4>
                <p>相手: 鈴木 茂 教授 | 確定日時: 5月22日(金) 10:00〜10:30</p>
              </div>
            </div>
            <span className={`${styles.statusBadge} ${styles.statusDone}`}>メール作成完了 (コピー済)</span>
          </div>

          <div className={styles.timelineItem}>
            <div className={styles.timelineLeft}>
              <div className={styles.timelineAvatar}>🏢</div>
              <div className={styles.timelineInfo}>
                <h4>エントリーシート(ES)添削依頼</h4>
                <p>相手: キャリアセンター (進路支援課) | 申請日時: 5月18日</p>
              </div>
            </div>
            <span className={`${styles.statusBadge} ${styles.statusDone}`}>調整完了</span>
          </div>

          <div className={styles.timelineItem} style={{ opacity: 0.7 }}>
            <div className={styles.timelineLeft}>
              <div className={styles.timelineAvatar}>👩‍🏫</div>
              <div className={styles.timelineInfo}>
                <h4>履修登録の修正に関する相談</h4>
                <p>相手: 高橋 美咲 准教授 | 申請日時: 5月12日</p>
              </div>
            </div>
            <span className={`${styles.statusBadge} ${styles.statusCancel}`}>キャンセル済</span>
          </div>
        </div>
      </section>
    </div>
  );
}
