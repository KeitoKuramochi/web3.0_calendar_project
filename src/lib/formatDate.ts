const DAYS = ["日", "月", "火", "水", "木", "金", "土"]

export function formatJa(isoStr: string): string {
  const d = new Date(isoStr)
  return `${d.getMonth() + 1}月${d.getDate()}日(${DAYS[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatJaWithEnd(isoStr: string, durationMin: number): string {
  const start = new Date(isoStr)
  const end = new Date(start.getTime() + durationMin * 60 * 1000)
  return `${start.getMonth() + 1}月${start.getDate()}日(${DAYS[start.getDay()]}) ${pad(start.getHours())}:${pad(start.getMinutes())}〜${pad(end.getHours())}:${pad(end.getMinutes())}`
}

// 連続するスロットを「6月12日(木) 10:00〜12:00」形式にまとめる
export function mergeConsecutiveSlots(slots: string[], durationMin: number): string[] {
  if (slots.length === 0) return []
  const sorted = [...slots].sort()
  const result: string[] = []
  let groupStart = sorted[0]
  let groupEnd = new Date(new Date(sorted[0]).getTime() + durationMin * 60 * 1000)

  for (let i = 1; i < sorted.length; i++) {
    const cur = new Date(sorted[i])
    if (Math.abs(cur.getTime() - groupEnd.getTime()) <= 60000) {
      // 連続 → グループを延長
      groupEnd = new Date(cur.getTime() + durationMin * 60 * 1000)
    } else {
      // 連続しない → 確定して新グループ
      result.push(formatRange(groupStart, groupEnd))
      groupStart = sorted[i]
      groupEnd = new Date(cur.getTime() + durationMin * 60 * 1000)
    }
  }
  result.push(formatRange(groupStart, groupEnd))
  return result
}

function formatRange(startIso: string, endDate: Date): string {
  const s = new Date(startIso)
  return `${s.getMonth() + 1}月${s.getDate()}日(${DAYS[s.getDay()]}) ${pad(s.getHours())}:${pad(s.getMinutes())}〜${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
