import { analysisResultSchema, type AnalysisResult } from '@shared/schema.ts'
import { ApiError, requestAnalysis } from '../api/analyze.ts'
import { PdfReadError } from './pdfReadError.ts'

export type Progress =
  { stage: 'reading'; page: number; total: number } | { stage: 'analyzing'; scanPages: number }

export class AnalysisError extends Error {
  readonly userMessage: string
  readonly retryable: boolean
  constructor(userMessage: string, retryable: boolean, cause?: unknown) {
    super(userMessage, { cause })
    this.name = 'AnalysisError'
    this.userMessage = userMessage
    this.retryable = retryable
  }
}

function shorten(text: string, max = 600): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

/** Cały przepływ: odczyt PDF w przeglądarce → analiza na serwerze → walidacja przed wyświetleniem. */
export async function analyzeFile(
  file: File,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  let extracted
  try {
    // pdf.js (~0,5 MB) ładowany dopiero przy pierwszym pliku, żeby strona startowa była lekka.
    const { extractPdf } = await import('./extractPdf.ts')
    extracted = await extractPdf(file, (page, total) =>
      onProgress({ stage: 'reading', page, total }),
    )
  } catch (error) {
    if (error instanceof PdfReadError) throw new AnalysisError(error.userMessage, false, error)
    throw new AnalysisError('Nie udało się odczytać pliku PDF.', false, error)
  }

  onProgress({ stage: 'analyzing', scanPages: extracted.images.length })
  let raw: unknown
  try {
    raw = await requestAnalysis(
      {
        fileName: file.name,
        pageCount: extracted.pageCount,
        pages: extracted.pages,
        images: extracted.images,
      },
      signal,
    )
  } catch (error) {
    if (error instanceof ApiError)
      throw new AnalysisError(error.userMessage, error.retryable, error)
    throw error
  }

  // Ukryty tekst nie trafił do modelu; informacja o nim trafia do wyniku jako ostrzeżenie.
  const extraWarnings = extracted.hiddenText.map(
    (h) =>
      `Na stronie ${h.page} wykryto tekst niewidoczny dla czytelnika (np. biały na białym tle). Pominięto go w analizie. Treść: „${shorten(h.text)}”`,
  )
  if (extracted.skippedScanPages.length > 0) {
    const pages = extracted.skippedScanPages
    extraWarnings.push(
      pages.length === 1
        ? `Strona ${pages[0]} nie ma warstwy tekstowej i nie została odczytana (limit stron skanowanych).`
        : `Strony ${pages.join(', ')} nie mają warstwy tekstowej i nie zostały odczytane (limit stron skanowanych).`,
    )
  }
  if (extracted.uncheckedPages.length > 0) {
    extraWarnings.push(
      `Dla stron od ${extracted.uncheckedPages[0]} nie sprawdzano ukrytego tekstu (bardzo długi dokument).`,
    )
  }

  const merged =
    typeof raw === 'object' && raw !== null
      ? {
          ...raw,
          warnings: [...extraWarnings, ...((raw as { warnings?: unknown[] }).warnings ?? [])],
          meta: {
            ...((raw as { meta?: object }).meta ?? {}),
            hiddenTextPages: extracted.hiddenText.map((h) => h.page),
          },
        }
      : raw

  const parsed = analysisResultSchema.safeParse(merged)
  if (!parsed.success) {
    throw new AnalysisError(
      'Odpowiedź serwera ma niepoprawny format. Spróbuj ponownie.',
      true,
      parsed.error,
    )
  }
  return parsed.data
}
