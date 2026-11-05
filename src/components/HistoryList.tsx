import type { HistoryEntry } from '../lib/history.ts'
import { DOCUMENT_TYPE_LABELS } from '../lib/format.ts'

interface Props {
  entries: HistoryEntry[]
  activeId: string | null
  onOpen: (entry: HistoryEntry) => void
  onClear: () => void
}

const timeFormat = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function HistoryList({ entries, activeId, onOpen, onClear }: Props) {
  if (entries.length === 0) return null
  return (
    <section className="card history" aria-labelledby="history-title">
      <div className="history-head">
        <h2 id="history-title" className="card-title">
          Ostatnie analizy
        </h2>
        <button type="button" className="button button-small button-ghost" onClick={onClear}>
          Wyczyść
        </button>
      </div>
      <p className="muted small">Zapisane tylko w tej przeglądarce.</p>
      <ul>
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className={`history-item${e.id === activeId ? ' is-active' : ''}`}
              aria-current={e.id === activeId ? 'true' : undefined}
              onClick={() => onOpen(e)}
            >
              <span className="history-name">{e.result.document.fileName}</span>
              <span className="muted small">
                {DOCUMENT_TYPE_LABELS[e.result.document.type] ?? e.result.document.type} ·{' '}
                {timeFormat.format(new Date(e.savedAt))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
