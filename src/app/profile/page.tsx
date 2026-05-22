"use client";

import React, { useState, useEffect } from "react";
import { Save, User, Mail, School, BookOpen, Clock, AlertTriangle } from "lucide-react";
import styles from "./profile.module.css";
import { UserProfile, UserRole } from "@/types";
import { DUMMY_USERS, DUMMY_TOPICS } from "@/lib/dummyData";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>({
    id: "student_1",
    name: "佐藤 拓海",
    email: "sato.takumi@univ.ac.jp",
    role: "student",
    department: "情報工学科3年",
    avatar: "👨‍🎓",
    topics: ["履修登録", "研究室選び"],
    availableTimesFreeText: "木曜と金曜の午前中が空いています。",
    avoidTimesFreeText: "月曜日は講義が詰まっているため避けたいです。",
    absoluteNGTimes: ["Monday-Morning", "Monday-Afternoon"],
    mailPolicy: "丁寧なやり取りを心がけます。",
    mailRequiredInfo: ["学籍番号", "氏名"],
  });

  const [showToast, setShowToast] = useState(false);
  const [selectedRequiredInfo, setSelectedRequiredInfo] = useState<string[]>(["学籍番号", "氏名"]);

  // クライアントサイドでの初期ロード
  useEffect(() => {
    const saved = localStorage.getItem("user_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfile(parsed);
        setSelectedRequiredInfo(parsed.mailRequiredInfo || []);
      } catch (e) {
        console.error("Failed to load profile from localStorage", e);
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTopicChange = (topic: string) => {
    setProfile(prev => {
      const isSelected = prev.topics.includes(topic);
      const newTopics = isSelected
        ? prev.topics.filter(t => t !== topic)
        : [...prev.topics, topic];
      return { ...prev, topics: newTopics };
    });
  };

  const handleRequiredInfoToggle = (info: string) => {
    let updated: string[];
    if (selectedRequiredInfo.includes(info)) {
      updated = selectedRequiredInfo.filter(item => item !== info);
    } else {
      updated = [...selectedRequiredInfo, info];
    }
    setSelectedRequiredInfo(updated);
    setProfile(prev => ({
      ...prev,
      mailRequiredInfo: updated
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("user_profile", JSON.stringify(profile));
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // デモ用に他のダミーデータ（教員など）をロードする機能
  const loadDemoUser = (userId: string) => {
    const found = DUMMY_USERS.find(u => u.id === userId);
    if (found) {
      setProfile(found);
      setSelectedRequiredInfo(found.mailRequiredInfo || []);
    }
  };

  const requiredInfoOptions = ["学籍番号", "氏名", "相談内容の具体的なテーマ", "現在の研究内容", "エラー箇所のコード・写真"];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>プロフィール設定</h1>
        <p>あなたの予定感や連絡方針を登録しておくと、AIがそれらを考慮した日程調整とメール作成の最適化を行います。</p>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", alignSelf: "center" }}>デモ用データの読込:</span>
        <button 
          onClick={() => loadDemoUser("prof_suzuki")} 
          className={styles.infoTagButton}
          type="button"
        >
          鈴木茂教授 (教員デモ)
        </button>
        <button 
          onClick={() => loadDemoUser("prof_takahashi")} 
          className={styles.infoTagButton}
          type="button"
        >
          高橋美咲准教授 (教員デモ)
        </button>
        <button 
          onClick={() => loadDemoUser("student_1")} 
          className={styles.infoTagButton}
          type="button"
        >
          佐藤拓海 (学生デフォルト)
        </button>
      </div>

      <form onSubmit={handleSave} className="glass-card fade-in">
        <div className={styles.formGrid}>
          {/* 名前 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <User size={16} />
              名前
            </label>
            <input
              type="text"
              name="name"
              value={profile.name}
              onChange={handleChange}
              className={styles.input}
              required
            />
          </div>

          {/* メール */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <Mail size={16} />
              メールアドレス
            </label>
            <input
              type="email"
              name="email"
              value={profile.email}
              onChange={handleChange}
              className={styles.input}
              required
            />
          </div>

          {/* 所属 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <School size={16} />
              所属（学科・研究室など）
            </label>
            <input
              type="text"
              name="department"
              value={profile.department}
              onChange={handleChange}
              className={styles.input}
              placeholder="例: 情報工学科 3年"
              required
            />
          </div>

          {/* 役割 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              ロール（役割）
            </label>
            <select
              name="role"
              value={profile.role}
              onChange={handleChange}
              className={styles.select}
            >
              <option value="student">学生 (Student)</option>
              <option value="professor">教員 (Professor)</option>
              <option value="staff">職員 (Staff)</option>
              <option value="ta">大学院生TA (TA)</option>
            </select>
          </div>

          {/* 対応可能な相談内容 / 関心のある内容 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>
              <BookOpen size={16} />
              {profile.role === "student" ? "相談・質問したい内容" : "対応可能な相談内容"}
            </label>
            <div className={styles.checkboxGroup}>
              {DUMMY_TOPICS.map(topic => (
                <label key={topic} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={profile.topics.includes(topic)}
                    onChange={() => handleTopicChange(topic)}
                    className={styles.checkbox}
                  />
                  <span>{topic}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 会いやすい時間 (自由文) */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>
              <Clock size={16} />
              会いやすい時間（自由文での予定感）
            </label>
            <textarea
              name="availableTimesFreeText"
              value={profile.availableTimesFreeText}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="例: 金曜日の午前中は比較的空いています。平日の夕方16:30以降も対応可能です。"
              required
            />
          </div>

          {/* 避けたい時間 (自由文) */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>
              <AlertTriangle size={16} />
              できれば避けたい時間帯（自由文での予定感）
            </label>
            <textarea
              name="avoidTimesFreeText"
              value={profile.avoidTimesFreeText}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="例: 水曜日は会議が多いため、できるだけ避けてください。"
            />
          </div>

          {/* メール方針 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>
              連絡・メールに対する基本方針
            </label>
            <input
              type="text"
              name="mailPolicy"
              value={profile.mailPolicy}
              onChange={handleChange}
              className={styles.input}
              placeholder="例: 事前に具体的な相談テーマと用件を送ってください。メールで済む内容はメールで完結希望。"
            />
          </div>

          {/* メールに記載してほしい情報（チェックボックスまたはタグ） */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>
              面談依頼のメールに含めてほしい情報（複数選択可）
            </label>
            <div className={styles.infoTagGroup}>
              {requiredInfoOptions.map(info => {
                const isActive = selectedRequiredInfo.includes(info);
                return (
                  <button
                    key={info}
                    type="button"
                    className={`${styles.infoTagButton} ${isActive ? styles.infoTagActive : ""}`}
                    onClick={() => handleRequiredInfoToggle(info)}
                  >
                    {info}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="submit" className={styles.btnSave}>
            <Save size={18} />
            設定を保存
          </button>
        </div>
      </form>

      {showToast && (
        <div className={styles.toast}>
          <span>✓ プロフィール設定を保存しました（ローカル）</span>
        </div>
      )}
    </div>
  );
}
