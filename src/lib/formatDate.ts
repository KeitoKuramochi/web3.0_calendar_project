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

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
