import { useEffect, useState } from 'react'
import type { Progress } from '../lib/analyzeFile.ts'
import { formatSeconds } from '../lib/format.ts'

interface Props {
  fileName: string
  progress: Progress
  startedAt: number
  onCancel: () => void
}

export function ProgressView({ fileName, progress, startedAt, onCancel }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [])

  const reading = progress.stage === 'reading'
  const steps = [
    {
      label: reading
        ? `Odczyt tekstu: strona ${progress.page} z ${progress.total}`
        : 'Odczyt tekstu',
      state: reading ? 'active' : 'done',
    },
    {
      label:
        progress.stage === 'analyzing' && progress.scanPages > 0
          ? `Analiza AI (w tym ${progress.scanPages} ${progress.scanPages === 1 ? 'strona skanowana' : 'strony skanowane'})`
          : 'Analiza AI: podsumowanie i dane',
      state: reading ? 'pending' : 'active',
    },
  ] as const

  return (
    <section className="card progress" aria-labelledby="progress-title">
      <div className="progress-head">
        <h2 id="progress-title" className="card-title">
          Analizuję „{fileName}”
        </h2>
        <span className="progress-time" aria-hidden="true">
          {formatSeconds(now - startedAt)}
        </span>
      </div>
      <ol className="steps">
        {steps.map((s) => (
          <li key={s.label} className={`step step-${s.state}`}>
            <span className="step-dot" aria-hidden="true" />
            <span>{s.label}</span>
            <span className="visually-hidden">
              {s.state === 'done'
                ? ' (zakończono)'
                : s.state === 'active'
                  ? ' (w toku)'
                  : ' (oczekuje)'}
            </span>
          </li>
        ))}
      </ol>
      <div className="progress-bar" aria-hidden="true">
        <div className={`progress-bar-fill ${reading ? 'is-reading' : 'is-analyzing'}`} />
      </div>
      <p className="muted small">
        Zostaw tę kartę otwartą: przeglądarka spowalnia karty działające w tle.
      </p>
      <button type="button" className="button button-ghost" onClick={onCancel}>
        Anuluj
      </button>
    </section>
  )
}
