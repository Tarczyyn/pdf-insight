import { analysisResultSchema, type AnalysisResult } from '@shared/schema.ts'

const KEY = 'pdf-insight:history:v1'
export const HISTORY_LIMIT = 10

export interface HistoryEntry {
  id: string
  savedAt: string
  durationMs: number
  result: AnalysisResult
}

/** Minimalny interfejs magazynu, żeby dało się testować bez przeglądarki. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Wpisy, które nie przechodzą walidacji (np. stary format), są pomijane. */
export function loadHistory(store: KeyValueStore | null = defaultStore()): HistoryEntry[] {
  if (!store) return []
  try {
    const raw: unknown = JSON.parse(store.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.flatMap((entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) return []
      const e = entry as Partial<HistoryEntry>
      const parsed = analysisResultSchema.safeParse(e.result)
      if (!parsed.success || typeof e.id !== 'string' || typeof e.savedAt !== 'string') return []
      return [
        {
          id: e.id,
          savedAt: e.savedAt,
          durationMs: Number(e.durationMs) || 0,
          result: parsed.data,
        },
      ]
    })
  } catch {
    return []
  }
}

export function saveToHistory(
  entry: HistoryEntry,
  store: KeyValueStore | null = defaultStore(),
): HistoryEntry[] {
  const next = [entry, ...loadHistory(store).filter((e) => e.id !== entry.id)].slice(
    0,
    HISTORY_LIMIT,
  )
  if (!store) return next
  try {
    store.setItem(KEY, JSON.stringify(next))
  } catch {
    // Pełny magazyn lub tryb prywatny: historia po prostu się nie zapisze.
  }
  return next
}

export function clearHistory(store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.removeItem(KEY)
  } catch {
    // jak wyżej
  }
}
