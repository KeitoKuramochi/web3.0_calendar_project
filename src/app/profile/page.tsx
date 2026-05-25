"use client"

import React, { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Save, User, Mail, BookOpen, Clock, AlertTriangle, Plus, X, Link as LinkIcon, CheckCircle2, Loader } from "lucide-react"
import styles from "./profile.module.css"
import { UserProfile, ContactMethod, ContactType } from "@/types"
import { POPULAR_TOPICS, POPULAR_ROLES, MAIL_REQUIRED_INFO_OPTIONS } from "@/lib/dummyData"

const CONTACT_TYPE_OPTIONS: { value: ContactType; label: string; placeholder: string }[] = [
  { value: "discord", label: "Discord",    placeholder: "例: username#1234 または username" },
  { value: "slack",   label: "Slack",      placeholder: "例: workspace.slack.com / @handle" },
  { value: "line",    label: "LINE",        placeholder: "例: your_line_id" },
  { value: "twitter", label: "Twitter/X",  placeholder: "例: @your_handle" },
  { value: "github",  label: "GitHub",     placeholder: "例: your-username" },
  { value: "custom",  label: "その他",     placeholder: "例: https://example.com/contact" },
]

const DEFAULT_PROFILE: UserProfile = {
  id: "user_default",
  name: "",
  email: "",
  role: "",
  department: "",
  bio: "",
  publicIntro: "",
  avatar: "👤",
  topics: [],
  customTopics: "",
  contactMethods: [],
  availableTimesFreeText: "",
  avoidTimesFreeText: "",
  absoluteNGTimes: [],
  mailPolicy: "",
  mailRequiredInfo: [],
  customMailRequiredInfo: "",
}

export default function ProfilePage() {
  const { data: session } = useSession()

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle")
  const [customTopicInput, setCustomTopicInput] = useState("")
  const [customMailInput, setCustomMailInput] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const userEditedRef = useRef(false)

  const markEdited = () => { userEditedRef.current = true }

  // 連絡先追加フォームの state
  const [showContactForm, setShowContactForm] = useState(false)
  const [newContactType, setNewContactType] = useState<ContactType>("discord")
  const [newContactLabel, setNewContactLabel] = useState("")
  const [newContactValue, setNewContactValue] = useState("")

  useEffect(() => {
    fetch("/api/profile").then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        if (data) { setProfile(data); return }
      }
      if (session?.user) {
        setProfile((prev) => ({
          ...prev,
          name: session.user.name ?? "",
          email: session.user.email ?? "",
        }))
      }
    })
  }, [session])

  // 変更検知 → 自動保存（1.5秒後）
  useEffect(() => {
    if (!userEditedRef.current) return
    setSaveStatus("unsaved")
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaveStatus("saving")
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      setSaveStatus("saved")
    }, 1500)
    return () => clearTimeout(timerRef.current)
  }, [profile])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    markEdited()
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  const toggleTopic = (topic: string) => {
    markEdited()
    setProfile((prev) => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter((t) => t !== topic)
        : [...prev.topics, topic],
    }))
  }

  const addCustomTopic = () => {
    const t = customTopicInput.trim()
    if (!t) return
    markEdited()
    if (!profile.topics.includes(t)) {
      setProfile((prev) => ({ ...prev, topics: [...prev.topics, t] }))
    }
    setCustomTopicInput("")
  }

  const removeTopic = (topic: string) => {
    markEdited()
    setProfile((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t !== topic),
    }))
  }

  const toggleMailInfo = (info: string) => {
    markEdited()
    setProfile((prev) => ({
      ...prev,
      mailRequiredInfo: prev.mailRequiredInfo.includes(info)
        ? prev.mailRequiredInfo.filter((i) => i !== info)
        : [...prev.mailRequiredInfo, info],
    }))
  }

  const addCustomMailInfo = () => {
    const t = customMailInput.trim()
    if (!t) return
    markEdited()
    if (!profile.mailRequiredInfo.includes(t)) {
      setProfile((prev) => ({
        ...prev,
        mailRequiredInfo: [...prev.mailRequiredInfo, t],
      }))
    }
    setCustomMailInput("")
  }

  const removeMailInfo = (info: string) => {
    markEdited()
    setProfile((prev) => ({
      ...prev,
      mailRequiredInfo: prev.mailRequiredInfo.filter((i) => i !== info),
    }))
  }

  const addContactMethod = () => {
    const val = newContactValue.trim()
    if (!val) return
    markEdited()
    const defaultLabel = CONTACT_TYPE_OPTIONS.find((o) => o.value === newContactType)?.label ?? newContactType
    const label = newContactLabel.trim() || defaultLabel
    const method: ContactMethod = { type: newContactType, label, value: val }
    setProfile((prev) => ({ ...prev, contactMethods: [...(prev.contactMethods ?? []), method] }))
    setNewContactValue("")
    setNewContactLabel("")
    setShowContactForm(false)
  }

  const removeContactMethod = (index: number) => {
    markEdited()
    setProfile((prev) => ({
      ...prev,
      contactMethods: (prev.contactMethods ?? []).filter((_, i) => i !== index),
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    clearTimeout(timerRef.current)
    setSaveStatus("saving")
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    })
    setSaveStatus("saved")
  }

  // POPULAR_TOPICS に含まれないカスタムトピックのみ表示
  const customOnlyTopics = profile.topics.filter((t) => !POPULAR_TOPICS.includes(t))

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>プロフィール設定</h1>
        <p>あなたの予定感や連絡方針を登録すると、AIが日程調整とメール作成を最適化します。自由に書けます。</p>
      </div>

      {!profile.name && saveStatus === "idle" && (
        <div style={{
          padding: "11px 16px", background: "var(--color-secondary-bg)",
          border: "2px solid rgba(245, 200, 74, 0.3)", borderRadius: 14,
          fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>🌱</span>
          まだプロフィールが設定されていません。名前とメールアドレスだけでも入力すると、メッセージ生成の精度が上がります。
        </div>
      )}

      <form onSubmit={handleSave} className="glass-card fade-in">
        <div className={styles.formGrid}>

          {/* ── 基本情報 ── */}
          <div className={styles.formSectionHeader}>
            <User size={15} /><span>基本情報</span>
          </div>

          {/* 名前 */}
          <div className={styles.formGroup}>
            <label className={styles.label}><User size={15} />名前</label>
            <input type="text" name="name" value={profile.name} onChange={handleChange} className={styles.input} placeholder="例: 佐藤 拓海" required />
          </div>

          {/* メール */}
          <div className={styles.formGroup}>
            <label className={styles.label}><Mail size={15} />メールアドレス（デフォルトの連絡先）</label>
            <input type="email" name="email" value={profile.email} onChange={handleChange} className={styles.input} placeholder="例: sato@univ.ac.jp" required />
          </div>

          {/* 追加の連絡先 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}><LinkIcon size={15} />追加の連絡先（Discord ID・Slackなど）</label>
            <p className={styles.fieldHint}>メール以外で連絡できる方法を追加できます。公開プロフィールに表示されます。</p>

            {/* 登録済み連絡先 */}
            {(profile.contactMethods ?? []).length > 0 && (
              <div className={styles.contactChipList}>
                {(profile.contactMethods ?? []).map((m, i) => (
                  <span key={i} className={styles.contactChip}>
                    <span className={styles.contactChipLabel}>{m.label}</span>
                    <span className={styles.contactChipValue}>{m.value}</span>
                    <button type="button" onClick={() => removeContactMethod(i)} className={styles.removeBtn}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}

            {/* 追加フォーム */}
            {showContactForm ? (
              <div className={styles.contactAddForm}>
                <select
                  value={newContactType}
                  onChange={(e) => {
                    setNewContactType(e.target.value as ContactType)
                    setNewContactLabel("")
                  }}
                  className={styles.contactTypeSelect}
                >
                  {CONTACT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newContactLabel}
                  onChange={(e) => setNewContactLabel(e.target.value)}
                  className={styles.input}
                  placeholder={`表示名（省略可・デフォルト: ${CONTACT_TYPE_OPTIONS.find((o) => o.value === newContactType)?.label}）`}
                  style={{ flex: "1" }}
                />
                <input
                  type="text"
                  value={newContactValue}
                  onChange={(e) => setNewContactValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addContactMethod() } }}
                  className={styles.input}
                  placeholder={CONTACT_TYPE_OPTIONS.find((o) => o.value === newContactType)?.placeholder}
                  style={{ flex: "2" }}
                />
                <button type="button" onClick={addContactMethod} className={styles.btnAddFree}><Plus size={16} /></button>
                <button type="button" onClick={() => setShowContactForm(false)} className={styles.btnCancelContact}><X size={14} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowContactForm(true)} className={styles.btnAddContact}>
                <Plus size={14} />
                連絡先を追加
              </button>
            )}
          </div>


          {/* 公開プロフィール紹介文 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>公開プロフィール用の自己紹介文</label>
            <p className={styles.fieldHint}>相談を考えている方が最初に目にする自己紹介文です。</p>
            <textarea
              name="publicIntro"
              value={profile.publicIntro ?? ""}
              onChange={handleChange}
              className={styles.textarea}
              style={{ minHeight: "80px" }}
              placeholder="例: 情報工学科3年の佐藤です。研究室配属や進路についてご相談できる方を探しています。"
            />
          </div>

          {/* ── 役割・所属 ── */}
          <div className={styles.formSectionHeader}>
            <BookOpen size={15} /><span>役割・所属</span>
          </div>

          {/* ロール（自由入力 + 人気候補） */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>ロール・役割</label>
            <input
              type="text"
              name="role"
              value={profile.role}
              onChange={handleChange}
              className={styles.input}
              placeholder="例: 学部生、大学院生、研究室教員、TA、サークル代表…"
            />
            <div className={styles.suggestRow}>
              {POPULAR_ROLES.map((r) => (
                <button key={r} type="button"
                  className={`${styles.suggestChip} ${profile.role === r ? styles.suggestChipActive : ""}`}
                  onClick={() => setProfile((p) => ({ ...p, role: r }))}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 所属（自由記述） */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>所属・部署・学科など（自由記述）</label>
            <input
              type="text"
              name="department"
              value={profile.department}
              onChange={handleChange}
              className={styles.input}
              placeholder="例: 情報工学科3年、計算機アーキテクチャ研究室、学生支援本部…"
            />
          </div>

          {/* 自由記述（bio） */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>自由記述（学年・専門・その他何でも）</label>
            <textarea
              name="bio"
              value={profile.bio ?? ""}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="自由に書いてください。AIがここの内容も参考にして相談先のマッチングや文章生成を行います。"
            />
          </div>

          {/* ── 相談できること ── */}
          <div className={styles.formSectionHeader}>
            <BookOpen size={15} /><span>相談できること</span>
          </div>

          {/* 相談トピック（タグ + カスタム） */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}><BookOpen size={15} />相談・対応できる内容（複数選択可）</label>

            <div className={styles.tagGrid}>
              {POPULAR_TOPICS.map((t) => (
                <button key={t} type="button"
                  className={`${styles.tagChip} ${profile.topics.includes(t) ? styles.tagChipActive : ""}`}
                  onClick={() => toggleTopic(t)}>
                  {t}
                </button>
              ))}
            </div>

            {/* カスタムトピック表示 */}
            {customOnlyTopics.length > 0 && (
              <div className={styles.customTagRow}>
                {customOnlyTopics.map((t) => (
                  <span key={t} className={`${styles.tagChip} ${styles.tagChipActive}`}>
                    {t}
                    <button type="button" onClick={() => removeTopic(t)} className={styles.removeBtn}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}

            <div className={styles.freeInputRow}>
              <input
                type="text"
                value={customTopicInput}
                onChange={(e) => setCustomTopicInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTopic() } }}
                className={styles.input}
                placeholder="その他のトピックを入力して Enter"
              />
              <button type="button" onClick={addCustomTopic} className={styles.btnAddFree}><Plus size={16} /></button>
            </div>
          </div>

          {/* ── 空き時間・スケジュール ── */}
          <div className={styles.formSectionHeader}>
            <Clock size={15} /><span>空き時間・スケジュール</span>
          </div>

          {/* 会いやすい時間 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}><Clock size={15} />会いやすい時間帯（自由記述）</label>
            <textarea
              name="availableTimesFreeText"
              value={profile.availableTimesFreeText}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="例: 金曜日の午前中は比較的空いています。平日の夕方16:30以降も対応可能です。"
            />
          </div>

          {/* 避けたい時間 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}><AlertTriangle size={15} />できれば避けたい時間帯（自由記述）</label>
            <textarea
              name="avoidTimesFreeText"
              value={profile.avoidTimesFreeText}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="例: 水曜日は会議が多いためできるだけ避けてください。"
            />
          </div>

          {/* ── 連絡・メール方針 ── */}
          <div className={styles.formSectionHeader}>
            <Mail size={15} /><span>連絡・メール方針</span>
          </div>

          {/* メール方針 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>連絡・メールに対する基本方針</label>
            <textarea
              name="mailPolicy"
              value={profile.mailPolicy}
              onChange={handleChange}
              className={styles.textarea}
              style={{ minHeight: "70px" }}
              placeholder="例: 事前に具体的な相談テーマと用件を送ってください。メールで済む内容はメールで完結希望。"
            />
          </div>

          {/* メールに入れてほしい情報（タグ + カスタム） */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>面談依頼のメールに含めてほしい情報</label>

            <div className={styles.tagGrid}>
              {MAIL_REQUIRED_INFO_OPTIONS.map((info) => (
                <button key={info} type="button"
                  className={`${styles.tagChip} ${profile.mailRequiredInfo.includes(info) ? styles.tagChipActive : ""}`}
                  onClick={() => toggleMailInfo(info)}>
                  {info}
                </button>
              ))}
            </div>

            {/* カスタム入力済みのもの */}
            {profile.mailRequiredInfo.filter((i) => !MAIL_REQUIRED_INFO_OPTIONS.includes(i)).map((info) => (
              <div key={info} className={styles.customTagRow}>
                <span className={`${styles.tagChip} ${styles.tagChipActive}`}>
                  {info}
                  <button type="button" onClick={() => removeMailInfo(info)} className={styles.removeBtn}><X size={11} /></button>
                </span>
              </div>
            ))}

            <div className={styles.freeInputRow}>
              <input
                type="text"
                value={customMailInput}
                onChange={(e) => setCustomMailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomMailInfo() } }}
                className={styles.input}
                placeholder="その他（例: 研究テーマの概要）を入力して Enter"
              />
              <button type="button" onClick={addCustomMailInfo} className={styles.btnAddFree}><Plus size={16} /></button>
            </div>
          </div>

        </div>

        <div className={styles.footer}>
          <span className={styles.saveStatus}>
            {saveStatus === "saving" && (
              <><Loader size={14} className={styles.spinIcon} />保存中…</>
            )}
            {saveStatus === "saved" && (
              <><CheckCircle2 size={14} style={{ color: "var(--color-excellent)" }} />保存済み</>
            )}
            {saveStatus === "unsaved" && (
              <span style={{ color: "var(--color-fair)" }}>未保存の変更があります</span>
            )}
          </span>
          <button type="submit" className={styles.btnSave}>
            <Save size={16} />
            今すぐ保存
          </button>
        </div>
      </form>
    </div>
  )
}
