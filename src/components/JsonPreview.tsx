import type { ReactNode } from 'react'
import { plural } from '../lib/format.ts'

interface Props {
  data: unknown
}

// Kolorowanie składni bez HTML-a: tekst JSON dzielimy na tokeny i oddajemy jako elementy React,
// więc treść z modelu nadal jest escapowana.
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

function highlight(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    const index = m.index
    if (index > last) out.push(text.slice(last, index))
    const [token, str, colon, literal] = m
    if (str !== undefined && colon !== undefined) {
      out.push(
        <span key={index} className="j-key">
          {str}
        </span>,
        colon,
      )
    } else if (str !== undefined) {
      out.push(
        <span key={index} className="j-str">
          {str}
        </span>,
      )
    } else {
      out.push(
        <span key={index} className={literal ? 'j-lit' : 'j-num'}>
          {token}
        </span>,
      )
    }
    last = index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function JsonPreview({ data }: Props) {
  const text = JSON.stringify(data, null, 2)
  const lines = text.split('\n').length

  return (
    <details className="json-preview">
      <summary>
        Pokaż JSON{' '}
        <span className="muted">
          · {lines} {plural(lines, 'linia', 'linie', 'linii')}
        </span>
      </summary>
      <pre tabIndex={0} aria-label="Wynik w formacie JSON">
        <code>{highlight(text)}</code>
      </pre>
    </details>
  )
}
