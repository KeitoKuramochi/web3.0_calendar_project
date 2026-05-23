import type { ConsultationRecord } from "@/types"

const CONSULTATIONS_KEY = "consultations_v2"
const ACTIVE_ID_KEY = "active_consultation_id"

export function getConsultations(): ConsultationRecord[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(CONSULTATIONS_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function upsertConsultation(record: ConsultationRecord): void {
  const all = getConsultations()
  const idx = all.findIndex((r) => r.id === record.id)
  const updated = { ...record, updatedAt: new Date().toISOString() }
  if (idx >= 0) {
    all[idx] = updated
  } else {
    all.unshift(updated)
  }
  localStorage.setItem(CONSULTATIONS_KEY, JSON.stringify(all))
}

export function deleteConsultation(id: string): void {
  const filtered = getConsultations().filter((r) => r.id !== id)
  localStorage.setItem(CONSULTATIONS_KEY, JSON.stringify(filtered))
  if (getActiveId() === id) clearActiveId()
}

export function getActiveId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_ID_KEY)
}

export function setActiveId(id: string): void {
  localStorage.setItem(ACTIVE_ID_KEY, id)
}

export function clearActiveId(): void {
  localStorage.removeItem(ACTIVE_ID_KEY)
}

export function getActiveConsultation(): ConsultationRecord | null {
  const id = getActiveId()
  if (!id) return null
  return getConsultations().find((r) => r.id === id) ?? null
}
