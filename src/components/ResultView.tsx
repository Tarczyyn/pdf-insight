import { useEffect, useRef } from 'react'
import type { AnalysisResult } from '@shared/schema.ts'
import {
  DOCUMENT_TYPE_LABELS,
  downloadJson,
  formatAmount,
  formatDate,
  formatSeconds,
  resultFileName,
} from '../lib/format.ts'
import { JsonPreview } from './JsonPreview.tsx'

interface Props {
  result: AnalysisResult
  durationMs: number
}

function Empty() {
  return <p className="muted">Brak w dokumencie.</p>
}

export function ResultView({ result, durationMs }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [result])

  const { document: doc } = result
  const lang = doc.language
  const unverified = result.amounts.filter((a) => !a.verified).length

  return (
    <article className="result" aria-labelledby="result-title">
      <header className="card result-header">
        <p className="eyebrow">
          {DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type} · {doc.pages}{' '}
          {doc.pages === 1 ? 'strona' : doc.pages < 5 ? 'strony' : 'stron'} · język:{' '}
          {doc.language.toUpperCase()}
          {doc.date ? ` · ${formatDate(doc.date, lang)}` : ''}
        </p>
        <h2 id="result-title" ref={headingRef} tabIndex={-1}>
          {doc.title ?? doc.fileName}
        </h2>
        <p className="muted small">
          {doc.fileName} · analiza w {formatSeconds(durationMs)} · model {result.meta.model}
        </p>
        <div className="actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => downloadJson(result, resultFileName(doc.fileName))}
          >
            Pobierz JSON
          </button>
        </div>
      </header>

      {result.warnings.length > 0 && (
        <section className="card warnings" aria-labelledby="warnings-title">
          <h3 id="warnings-title" className="card-title">
            Uwagi ({result.warnings.length})
          </h3>
          <ul>
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-labelledby="summary-title">
        <h3 id="summary-title" className="card-title">
          Podsumowanie
        </h3>
        <p className="summary" lang={lang}>
          {result.summary}
        </p>
        <h4 className="subhead">Najważniejsze punkty</h4>
        <ul className="key-points" lang={lang}>
          {result.keyPoints.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="amounts-title">
        <h3 id="amounts-title" className="card-title">
          Kwoty ({result.amounts.length})
        </h3>
        {result.amounts.length === 0 ? (
          <Empty />
        ) : (
          <>
            <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="amounts-title">
              <table className="stack-table">
                <thead>
                  <tr>
                    <th scope="col" className="num">
                      Kwota
                    </th>
                    <th scope="col">Waluta</th>
                    <th scope="col">Kontekst</th>
                  </tr>
                </thead>
                <tbody lang={lang}>
                  {result.amounts.map((a) => (
                    <tr key={`${a.value}-${a.currency}-${a.context}`}>
                      <td className="num">
                        {formatAmount(a.value, a.currency, lang)}
                        {!a.verified && (
                          <span className="badge" title="Wartości nie ma w warstwie tekstowej PDF">
                            sprawdź
                          </span>
                        )}
                      </td>
                      <td>{a.currency}</td>
                      <td className="ctx">{a.context}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unverified > 0 && (
              <p className="muted small">
                „sprawdź”: wartości nie ma w warstwie tekstowej PDF (np. pochodzi ze skanu). Warto
                porównać ją z oryginałem.
              </p>
            )}
          </>
        )}
      </section>

      <section className="card" aria-labelledby="dates-title">
        <h3 id="dates-title" className="card-title">
          Daty ({result.dates.length})
        </h3>
        {result.dates.length === 0 ? (
          <Empty />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="dates-title">
            <table className="stack-table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Kontekst</th>
                </tr>
              </thead>
              <tbody lang={lang}>
                {result.dates.map((d) => (
                  <tr key={`${d.date}-${d.context}`}>
                    <td className="nowrap">
                      <time dateTime={d.date}>{formatDate(d.date, lang)}</time>
                    </td>
                    <td className="ctx">{d.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="card" aria-labelledby="orgs-title">
          <h3 id="orgs-title" className="card-title">
            Organizacje
          </h3>
          {result.entities.organizations.length === 0 ? (
            <Empty />
          ) : (
            <ul className="plain-list">
              {result.entities.organizations.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="people-title">
          <h3 id="people-title" className="card-title">
            Osoby
          </h3>
          {result.entities.people.length === 0 ? (
            <Empty />
          ) : (
            <ul className="plain-list">
              {result.entities.people.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="keywords-title">
        <h3 id="keywords-title" className="card-title">
          Słowa kluczowe
        </h3>
        {result.keywords.length === 0 ? (
          <Empty />
        ) : (
          <ul className="chips" lang={lang}>
            {result.keywords.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <JsonPreview data={result} />
      </section>
    </article>
  )
}
