export function formatAmount(value: number, currency: string, language: string): string {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency }).format(value)
  } catch {
    return `${value.toLocaleString(language)} ${currency}`
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

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} s`
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
