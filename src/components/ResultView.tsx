import { useEffect, useRef, useState } from 'react'
import type { AnalysisResult } from '@shared/schema.ts'
import {
  DOCUMENT_TYPE_LABELS,
  downloadJson,
  formatDate,
  formatSeconds,
  languageName,
  plural,
  resultFileName,
} from '../lib/format.ts'
import { AmountsLedger } from './AmountsLedger.tsx'
import { DatesTimeline } from './DatesTimeline.tsx'
import { CheckIcon, CopyIcon, DownloadIcon } from './Icons.tsx'
import { JsonPreview } from './JsonPreview.tsx'
import { Notes } from './Notes.tsx'

interface Props {
  result: AnalysisResult
  durationMs: number
}

function Empty() {
  return <p className="empty-value">Brak w dokumencie.</p>
}

function pagesList(pages: number[]): string {
  return `str. ${pages.join(', ')}`
}

export function ResultView({ result, durationMs }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [result])
  const [copied, setCopied] = useState(false)

  const { document: doc, meta } = result
  const lang = doc.language
  const { organizations, people } = result.entities

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article className="sheet result" aria-labelledby="result-title">
      <header className="sheet-head">
        <h2 id="result-title" ref={headingRef} tabIndex={-1} lang={lang}>
          {doc.title ?? doc.fileName}
        </h2>
        <dl className="docmeta">
          <div>
            <dt>Typ</dt>
            <dd>{DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}</dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd>{doc.date ? formatDate(doc.date, 'pl') : 'brak'}</dd>
          </div>
          <div>
            <dt>Objętość</dt>
            <dd>
              {doc.pages} {plural(doc.pages, 'strona', 'strony', 'stron')}
            </dd>
          </div>
          <div>
            <dt>Język</dt>
            <dd>{languageName(lang)}</dd>
          </div>
          {meta.hiddenTextPages.length > 0 && (
            <div className="is-alert">
              <dt>Ukryty tekst</dt>
              <dd>{pagesList(meta.hiddenTextPages)}, pominięty</dd>
            </div>
          )}
          {meta.ocrPages.length > 0 && (
            <div>
              <dt>Odczyt ze skanu</dt>
              <dd>{pagesList(meta.ocrPages)}</dd>
            </div>
          )}
          <div className="wide">
            <dt>Plik</dt>
            <dd className="filename">{doc.fileName}</dd>
          </div>
          <div className="wide">
            <dt>Analiza</dt>
            <dd>
              {formatSeconds(durationMs)}, model {meta.model}
            </dd>
          </div>
        </dl>
        <div className="actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => downloadJson(result, resultFileName(doc.fileName))}
          >
            <DownloadIcon />
            Pobierz JSON
          </button>
          <button type="button" className="button" onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'Skopiowano' : 'Kopiuj JSON'}
          </button>
          <span className="visually-hidden" aria-live="polite">
            {copied ? 'Skopiowano JSON do schowka' : ''}
          </span>
        </div>
      </header>

      {result.warnings.length > 0 && <Notes warnings={result.warnings} headingId="notes-title" />}

      <section className="row" aria-labelledby="summary-title">
        <h3 id="summary-title" className="row-label">
          Podsumowanie
        </h3>
        <div className="row-body">
          <p className="summary" lang={lang}>
            {result.summary}
          </p>
          <h4 className="subhead">Najważniejsze punkty</h4>
          <ul className="key-points" lang={lang}>
            {result.keyPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="row" aria-labelledby="amounts-title">
        <h3 id="amounts-title" className="row-label">
          Kwoty <span className="count">{result.amounts.length}</span>
        </h3>
        <div className="row-body">
          {result.amounts.length === 0 ? (
            <Empty />
          ) : (
            <AmountsLedger amounts={result.amounts} lang={lang} headingId="amounts-title" />
          )}
        </div>
      </section>

      <section className="row" aria-labelledby="dates-title">
        <h3 id="dates-title" className="row-label">
          Daty <span className="count">{result.dates.length}</span>
        </h3>
        <div className="row-body">
          {result.dates.length === 0 ? (
            <Empty />
          ) : (
            <DatesTimeline dates={result.dates} lang={lang} />
          )}
        </div>
      </section>

      <section className="row" aria-labelledby="entities-title">
        <h3 id="entities-title" className="row-label">
          Strony i osoby
        </h3>
        <div className="row-body entities">
          <div>
            <h4 className="subhead">
              Organizacje <span className="count">{organizations.length}</span>
            </h4>
            {organizations.length === 0 ? (
              <Empty />
            ) : (
              <ul className="names">
                {organizations.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="subhead">
              Osoby <span className="count">{people.length}</span>
            </h4>
            {people.length === 0 ? (
              <Empty />
            ) : (
              <ul className={`names${people.length > 5 ? ' names-cols' : ''}`}>
                {people.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="row" aria-labelledby="keywords-title">
        <h3 id="keywords-title" className="row-label">
          Słowa kluczowe
        </h3>
        <div className="row-body">
          {result.keywords.length === 0 ? (
            <Empty />
          ) : (
            <ul className="keywords" lang={lang}>
              {result.keywords.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="row" aria-labelledby="json-title">
        <h3 id="json-title" className="row-label">
          JSON
        </h3>
        <div className="row-body">
          <JsonPreview data={result} />
        </div>
      </section>
    </article>
  )
}
