// Jedno źródło prawdy dla formatu wyniku. Importują go Edge Function (Deno) i frontend (Vite).
// Brief, sekcja 04: pól nie wolno usuwać, wolno dodawać. Dodane pola są oznaczone komentarzem.
import { z } from 'zod'

export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const

const supportedCurrencies: ReadonlySet<string> = (() => {
  try {
    return new Set(Intl.supportedValuesOf('currency'))
  } catch {
    return new Set<string>()
  }
})()

/** ISO 4217: trzy wielkie litery i (jeśli środowisko zna listę) kod faktycznie istniejący. */
export function isIsoCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false
  return supportedCurrencies.size === 0 || supportedCurrencies.has(code)
}

/** ISO 8601, sama data (RRRR-MM-DD), z kontrolą, że taki dzień istnieje. */
export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number) as [number, number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

// Skróty, po których kropka prawie nigdy nie kończy zdania ("ul. Portowa", "art. 28").
// Celowo nie ma tu "r.", "zł." ani "o.o.": często stoją na końcu zdania.
const NEVER_SENTENCE_END = new Set([
  'ul',
  'al',
  'pl',
  'nr',
  'ust',
  'pkt',
  'art',
  'tj',
  'np',
  'm.in',
  'sp',
  'dr',
  'inż',
  'prof',
  'zał',
  'św',
  'godz',
  'tel',
  'e.g',
  'i.e',
  'vs',
  'mr',
  'mrs',
  'ms',
])

/**
 * Przybliżona liczba zdań. Granica zdania to [.!?…] i spacja, po której jest wielka litera,
 * cyfra albo cudzysłów, o ile słowo przed kropką nie jest skrótem z NEVER_SENTENCE_END.
 * Kropki wewnątrz liczb i dat ("12.03.2026") nie są granicą, bo nie ma po nich spacji.
 */
export function countSentences(text: string): number {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  let count = 1
  const boundary = /([^\s]*?)([.!?…]+)["”»)]*\s+(?=["„«(]?[\p{Lu}\d])/gu
  for (const match of trimmed.matchAll(boundary)) {
    const word = (match[1] ?? '').toLowerCase()
    if (match[2] === '.' && NEVER_SENTENCE_END.has(word)) continue
    count += 1
  }
  return count
}

const nonEmpty = z.string().trim().min(1)

const isoDate = z
  .string()
  .refine(isIsoDate, { message: 'Data musi mieć format ISO 8601 (RRRR-MM-DD).' })

const currency = z
  .string()
  .refine(isIsoCurrency, { message: 'Waluta musi być kodem ISO 4217, np. PLN, EUR.' })

export const amountSchema = z.object({
  value: z.number().finite(),
  currency,
  context: nonEmpty,
})

export const dateSchema = z.object({
  date: isoDate,
  context: nonEmpty,
})

/**
 * Część wyniku, którą generuje model. Pola znane bez AI (nazwa pliku, liczba stron)
 * dokłada serwer, żeby model nie mógł ich przekłamać.
 */
export const aiOutputSchema = z.object({
  document: z.object({
    language: z.string().regex(/^[a-z]{2}$/, 'Język musi być kodem ISO 639-1, np. "pl".'),
    type: z.enum(DOCUMENT_TYPES),
    title: nonEmpty.nullable(),
    date: isoDate.nullable(),
  }),
  summary: nonEmpty.max(1500).refine((s) => {
    const n = countSentences(s)
    return n >= 3 && n <= 5
  }, 'Podsumowanie musi mieć 3–5 zdań.'),
  keyPoints: z.array(nonEmpty).min(3).max(7),
  entities: z.object({
    organizations: z.array(nonEmpty),
    people: z.array(nonEmpty),
  }),
  amounts: z.array(amountSchema),
  dates: z.array(dateSchema),
  keywords: z.array(nonEmpty),
  // Dodane pole: uwagi modelu, np. wykryte w treści polecenia skierowane do AI.
  warnings: z.array(nonEmpty),
})

export type AiOutput = z.infer<typeof aiOutputSchema>

/** Pełny wynik zgodny z sekcją 04 briefu, plus pola dodatkowe. */
export const analysisResultSchema = z.object({
  document: z.object({
    fileName: nonEmpty,
    pages: z.number().int().positive(),
    language: aiOutputSchema.shape.document.shape.language,
    type: aiOutputSchema.shape.document.shape.type,
    title: aiOutputSchema.shape.document.shape.title,
    date: aiOutputSchema.shape.document.shape.date,
  }),
  summary: aiOutputSchema.shape.summary,
  keyPoints: aiOutputSchema.shape.keyPoints,
  entities: aiOutputSchema.shape.entities,
  amounts: z.array(
    amountSchema.extend({
      // Dodane pole: czy wartość liczbowa występuje w warstwie tekstowej PDF.
      // false = kwota z OCR albo do ręcznego sprawdzenia.
      verified: z.boolean(),
    }),
  ),
  dates: aiOutputSchema.shape.dates,
  keywords: aiOutputSchema.shape.keywords,
  // Dodane pola:
  warnings: z.array(nonEmpty),
  meta: z.object({
    model: nonEmpty,
    analyzedAt: z.string().datetime(),
    ocrPages: z.array(z.number().int().positive()),
    hiddenTextPages: z.array(z.number().int().positive()),
  }),
})

export type AnalysisResult = z.infer<typeof analysisResultSchema>

/** Limity wejścia, wspólne dla frontu i serwera. */
export const LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxTextChars: 400_000,
  maxScanPages: 5,
  maxImageBase64Chars: 1_500_000,
  maxRequestBytes: 9 * 1024 * 1024,
} as const

export const analyzeRequestSchema = z.object({
  fileName: nonEmpty.max(255),
  pageCount: z.number().int().positive().max(2000),
  pages: z.array(z.object({ page: z.number().int().positive(), text: z.string() })).max(2000),
  images: z
    .array(
      z.object({
        page: z.number().int().positive(),
        mimeType: z.literal('image/jpeg'),
        data: z.string().min(1).max(LIMITS.maxImageBase64Chars),
      }),
    )
    .max(LIMITS.maxScanPages),
})

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>

export type ApiErrorCode =
  | 'bad_request'
  | 'forbidden_origin'
  | 'payload_too_large'
  | 'rate_limited'
  | 'ai_invalid'
  | 'ai_unavailable'
  | 'timeout'
  | 'internal'

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string }
}
