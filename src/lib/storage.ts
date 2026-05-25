import type { ConsultationRecord } from "@/types"

// アクティブIDはブラウザのみで管理（UIの一時状態）
const ACTIVE_KEY = "active_consultation_id"

export function getActiveId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id)
}

export function clearActiveId(): void {
  localStorage.removeItem(ACTIVE_KEY)
}

// 相談記録はDBで管理
export async function getConsultations(): Promise<ConsultationRecord[]> {
  const res = await fetch("/api/consultations")
  if (!res.ok) return []
  return res.json()
}

export async function upsertConsultation(record: ConsultationRecord): Promise<void> {
  await fetch("/api/consultations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  })
}

export async function deleteConsultation(id: string): Promise<void> {
  await fetch(`/api/consultations/${id}`, { method: "DELETE" })
}

export async function getActiveConsultation(): Promise<ConsultationRecord | null> {
  const id = getActiveId()
  if (!id) return null
  const res = await fetch(`/api/consultations/${id}`)
  if (!res.ok) return null
  return res.json()
}
