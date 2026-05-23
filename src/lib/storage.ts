import type { ConsultationRecord } from "@/types"

const consultationsKey = (userId = "guest") => `consultations_v2_${userId}`
const activeIdKey = (userId = "guest") => `active_consultation_id_${userId}`

export function getConsultations(userId?: string): ConsultationRecord[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(consultationsKey(userId)) ?? "[]")
  } catch {
    return []
  }
}

export function upsertConsultation(record: ConsultationRecord, userId?: string): void {
  const all = getConsultations(userId)
  const idx = all.findIndex((r) => r.id === record.id)
  const updated = { ...record, updatedAt: new Date().toISOString() }
  if (idx >= 0) {
    all[idx] = updated
  } else {
    all.unshift(updated)
  }
  localStorage.setItem(consultationsKey(userId), JSON.stringify(all))
}

export function deleteConsultation(id: string, userId?: string): void {
  const filtered = getConsultations(userId).filter((r) => r.id !== id)
  localStorage.setItem(consultationsKey(userId), JSON.stringify(filtered))
  if (getActiveId(userId) === id) clearActiveId(userId)
}

export function getActiveId(userId?: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(activeIdKey(userId))
}

export function setActiveId(id: string, userId?: string): void {
  localStorage.setItem(activeIdKey(userId), id)
}

export function clearActiveId(userId?: string): void {
  localStorage.removeItem(activeIdKey(userId))
}

export function getActiveConsultation(userId?: string): ConsultationRecord | null {
  const id = getActiveId(userId)
  if (!id) return null
  return getConsultations(userId).find((r) => r.id === id) ?? null
}
