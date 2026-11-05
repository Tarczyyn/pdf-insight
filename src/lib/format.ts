export function formatAmount(value: number, currency: string, language: string): string {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency }).format(value)
  } catch {
    return `${value.toLocaleString(language)} ${currency}`
  }
}

/**
 * Sama liczba z właściwą dla waluty liczbą miejsc po przecinku (JPY: 0, PLN: 2),
 * bez symbolu waluty. Kod waluty jest w osobnej kolumnie, więc liczby wyrównują się do prawej.
 */
export function formatAmountNumber(value: number, currency: string, language: string): string {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency })
      .formatToParts(value)
      .filter((p) => p.type !== 'currency')
      .map((p) => p.value)
      .join('')
      .trim()
  } catch {
    return value.toLocaleString(language)
  }
}

export function formatDate(iso: string, language: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  try {
    return new Intl.DateTimeFormat(language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)))
  } catch {
    return iso
  }
}

/** Dzisiejsza data jako RRRR-MM-DD w strefie czasowej użytkownika. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} s`
}

/** Polska odmiana liczebnika: 1 strona, 2–4 strony, 5–21 stron, 22 strony… */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const lastDigit = n % 10
  const lastTwo = n % 100
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many
}

/** Nazwa języka po polsku ("pl" → "polski"); przy braku wsparcia sam kod. */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['pl'], { type: 'language' }).of(code) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

export function resultFileName(pdfName: string): string {
  const base = pdfName.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}._-]+/gu, '_')
  return `${base || 'analiza'}.insight.json`
}

export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Inny dokument',
}
