"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, MessageSquare, Sparkles, Plus, Trash2, ShieldAlert, ArrowRight } from "lucide-react";
import styles from "./request.module.css";
import { parseFreeText } from "@/lib/ai";
import { ConsultRequest } from "@/types";

export default function RequestPage() {
  const router = useRouter();
  
  // フォームステート
  const [freeText, setFreeText] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [format, setFormat] = useState<"offline" | "online" | "hybrid">("hybrid");
  const [urgency, setUrgency] = useState<"high" | "normal" | "low">("normal");
  
  // 空き時間リスト
  const [tempDate, setTempDate] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([
    "2026-05-29T10:00", // 来週の金曜 10:00 (鈴木教授の空きと合致)
    "2026-05-29T11:00", // 来週の金曜 11:00 (鈴木教授の空きと合致)
    "2026-05-27T14:00", // 来週の水曜 14:00 (鈴木教授は会議でNG)
    "2026-05-28T15:00", // 来週の木曜 15:00 (高橋准教授の空きと合致)
  ]);

  // AIによる自動パース完了通知フラグ
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // 自由文の変更を汲み取るAIの実行
  const handleFreeTextBlur = () => {
    if (!freeText.trim()) return;

    const parsed = parseFreeText(freeText);
    
    // フォームに適用
    if (parsed.extractedTitle) setTitle(parsed.extractedTitle);
    setDuration(parsed.extractedDuration);
    setFormat(parsed.extractedFormat);
    setUrgency(parsed.extractedUrgency);

    // ユーザーへの通知バナーをセット
    const formatLabel = parsed.extractedFormat === "offline" ? "対面" : parsed.extractedFormat === "online" ? "オンライン" : "指定なし";
    setAiNotice(
      `AIが入力文を読み取りました：相談タイトルを「${parsed.extractedTitle}」、所要時間を「${parsed.extractedDuration}分」、面談形式を「${formatLabel}」と判定し、フォームに自動補完しました。`
    );
  };

  // 空き時間の追加
  const addTimeSlot = () => {
    if (!tempDate) return;
    // 重複チェック
    if (!availableTimes.includes(tempDate)) {
      setAvailableTimes(prev => [...prev, tempDate].sort());
    }
    setTempDate("");
  };

  // 空き時間の削除
  const removeTimeSlot = (slot: string) => {
    setAvailableTimes(prev => prev.filter(t => t !== slot));
  };

  // 日時の読みやすい日本語変換
  const formatTimeSlotJa = (slotStr: string) => {
    const d = new Date(slotStr);
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 送信処理 (次のマッチング画面へ)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (availableTimes.length === 0) {
      alert("自分の空き時間を少なくとも1つ以上追加してください。");
      return;
    }

    const requestData: Partial<ConsultRequest> = {
      id: `req_${Date.now()}`,
      requesterId: "student_1", // デフォルト学生
      title: title || "相談面談",
      duration,
      format,
      myAvailableTimes: availableTimes,
      freeTextInput: freeText,
      urgency
    };

    localStorage.setItem("consult_request", JSON.stringify(requestData));
    router.push("/match");
  };

  // デモ用プリセット入力
  const loadPreset = () => {
    const text = "来週くらいに進路について相談したいです。鈴木先生かキャリアセンターの方と対面で30分くらいでお話ししたいです。自分は金曜午前が空いています。急ぎではないです。";
    setFreeText(text);
    // モックパースを実行
    const parsed = parseFreeText(text);
    setTitle(parsed.extractedTitle);
    setDuration(parsed.extractedDuration);
    setFormat(parsed.extractedFormat);
    setUrgency(parsed.extractedUrgency);
    
    // デモ用に適した時間もセット
    setAvailableTimes([
      "2026-05-29T10:00", // 金曜午前 (鈴木教授◎)
      "2026-05-29T11:00", // 金曜午前 (鈴木教授◎)
      "2026-05-27T10:00", // 水曜午前 (鈴木教授NG)
      "2026-05-28T14:00"  // 木曜午後 (高橋准教授◎)
    ]);

    setAiNotice(
      `デモテキストを入力し、AIがタイトル「${parsed.extractedTitle}」、所要時間「${parsed.extractedDuration}分」、形式「対面」を自動推測して補完しました。`
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>相談リクエスト作成</h1>
        <p>相談したい内容や希望形式、あなたの空き時間を入力します。自由文からAIが自動で内容を汲み取ることも可能です。</p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button 
          onClick={loadPreset} 
          className={styles.btnAddSlot}
          style={{ background: "rgba(99, 102, 241, 0.15)", borderColor: "var(--color-primary)" }}
          type="button"
        >
          <Sparkles size={14} style={{ marginRight: "6px" }} />
          【デモ用】相談リクエストを自動入力する
        </button>
      </div>

      <form onSubmit={handleSubmit} className="glass-card fade-in">
        
        {/* 自由文入力エリア */}
        <div className={styles.sectionTitle}>
          <MessageSquare size={18} />
          <span>1. 自由文でニュアンスを伝える (推奨)</span>
        </div>
        
        <div className={styles.formGroupFull} style={{ marginBottom: "24px" }}>
          <label className={styles.label}>相談の目的や予定感について、自由に入力してください</label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onBlur={handleFreeTextBlur}
            placeholder="例: 来週くらいに進路について相談したいです。30分くらいで、できれば対面が良いです。自分は金曜日の午前中が比較的空いています。"
            className={styles.textarea}
          />
          {aiNotice && (
            <div className={styles.aiNotice}>
              <Sparkles size={16} style={{ color: "var(--color-secondary)" }} />
              <div>{aiNotice}</div>
            </div>
          )}
        </div>

        <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "24px 0" }} />

        {/* ポチポチ入力エリア */}
        <div className={styles.sectionTitle}>
          <Calendar size={18} />
          <span>2. 詳細条件を指定する (自動補完されます)</span>
        </div>

        <div className={styles.formGrid}>
          {/* タイトル */}
          <div className={styles.formGroup}>
            <label className={styles.label}>相談の件名</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 進路についての相談"
              className={styles.input}
              required
            />
          </div>

          {/* 所要時間 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>所要時間</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={styles.select}
            >
              <option value={15}>15分 (ちょっとした質問)</option>
              <option value={30}>30分 (標準的な相談)</option>
              <option value={60}>60分 (じっくり面談・添削等)</option>
              <option value={90}>90分 (詳細な模擬面接など)</option>
            </select>
          </div>

          {/* 面談形式 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>面談形式</label>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                onClick={() => setFormat("offline")}
                className={`${styles.toggleButton} ${format === "offline" ? styles.toggleButtonActive : ""}`}
              >
                対面
              </button>
              <button
                type="button"
                onClick={() => setFormat("online")}
                className={`${styles.toggleButton} ${format === "online" ? styles.toggleButtonActive : ""}`}
              >
                オンライン
              </button>
              <button
                type="button"
                onClick={() => setFormat("hybrid")}
                className={`${styles.toggleButton} ${format === "hybrid" ? styles.toggleButtonActive : ""}`}
              >
                どちらでも可
              </button>
            </div>
          </div>

          {/* 急ぎ度 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>優先度・急ぎ度</label>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                onClick={() => setUrgency("low")}
                className={`${styles.toggleButton} ${urgency === "low" ? styles.toggleButtonActive : ""}`}
              >
                急がない
              </button>
              <button
                type="button"
                onClick={() => setUrgency("normal")}
                className={`${styles.toggleButton} ${urgency === "normal" ? styles.toggleButtonActive : ""}`}
              >
                普通
              </button>
              <button
                type="button"
                onClick={() => setUrgency("high")}
                className={`${styles.toggleButton} ${urgency === "high" ? styles.toggleButtonActive : ""}`}
              >
                急ぎ
              </button>
            </div>
          </div>

          {/* 空き時間入力 (複数追加可能) */}
          <div className={styles.formGroupFull} style={{ marginTop: "10px" }}>
            <label className={styles.label}>
              <Clock size={16} />
              自分の空き時間・対応可能枠（複数追加してください）
            </label>
            
            <div className={styles.timeSlotInputGroup}>
              <input
                type="datetime-local"
                value={tempDate}
                onChange={(e) => setTempDate(e.target.value)}
                className={styles.input}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={addTimeSlot}
                className={styles.btnAddSlot}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Plus size={16} />
                時間枠を追加
              </button>
            </div>

            <div className={styles.timeSlotList}>
              {availableTimes.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "10px" }}>
                  追加された空き時間がありません。上記から日時を選択して追加してください。
                </div>
              ) : (
                availableTimes.map((slot) => (
                  <div key={slot} className={styles.timeSlotItem}>
                    <span>{formatTimeSlotJa(slot)}</span>
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(slot)}
                      className={styles.btnRemoveSlot}
                      title="削除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="submit" className={styles.btnSubmit}>
            相談先と日程候補を探す
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
