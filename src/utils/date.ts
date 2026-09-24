const DATE_PARTS = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseLocalDate(isoDate: string): Date {
  const match = DATE_PARTS.exec(isoDate)
  if (!match) return new Date()
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftIsoDate(isoDate: string, offset: number): string {
  const date = parseLocalDate(isoDate)
  date.setDate(date.getDate() + offset)
  return toIsoDate(date)
}

export function formatWeekday(isoDate: string): string {
  const lang = localStorage.getItem('friday-language') === 'zh' ? 'zh-CN' : 'en-US'
  return new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(parseLocalDate(isoDate))
}

export function formatMonthDay(isoDate: string): string {
  const lang = localStorage.getItem('friday-language') === 'zh' ? 'zh-CN' : 'en-US'
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(parseLocalDate(isoDate))
}
