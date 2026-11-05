import { useState } from 'react'

interface Props {
  data: unknown
}

export function JsonPreview({ data }: Props) {
  const [copied, setCopied] = useState(false)
  const text = JSON.stringify(data, null, 2)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <details className="json-preview">
      <summary>Podgląd JSON</summary>
      <div className="json-toolbar">
        <button type="button" className="button button-small" onClick={copy}>
          {copied ? 'Skopiowano' : 'Kopiuj'}
        </button>
        <span className="visually-hidden" aria-live="polite">
          {copied ? 'Skopiowano JSON do schowka' : ''}
        </span>
      </div>
      {/* Zwykły tekst w <pre>: React escapuje treść, bez wstrzykiwania HTML. */}
      <pre tabIndex={0} aria-label="Wynik w formacie JSON">
        <code>{text}</code>
      </pre>
    </details>
  )
}
