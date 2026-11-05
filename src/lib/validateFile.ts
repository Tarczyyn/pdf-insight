import { LIMITS } from '@shared/schema.ts'

export type FileCheck = { ok: true } | { ok: false; message: string }

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`
}

/** Walidacja przed odczytem: rozszerzenie/typ, rozmiar, sygnatura "%PDF-" na początku pliku. */
export async function validatePdfFile(file: File): Promise<FileCheck> {
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!looksLikePdf) return { ok: false, message: 'Obsługiwane są tylko pliki PDF.' }
  if (file.size === 0) return { ok: false, message: 'Plik jest pusty.' }
  if (file.size > LIMITS.maxFileBytes) {
    return {
      ok: false,
      message: `Plik ma ${formatMb(file.size)}. Maksymalny rozmiar to ${formatMb(LIMITS.maxFileBytes)}.`,
    }
  }
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const signature = new TextDecoder('latin1').decode(head)
  if (!signature.includes('%PDF-')) {
    return { ok: false, message: 'Plik ma rozszerzenie .pdf, ale jego zawartość nie jest PDF-em.' }
  }
  return { ok: true }
}
