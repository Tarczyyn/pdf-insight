import { useEffect, useState } from 'react'
import type { Progress } from '../lib/analyzeFile.ts'
import { formatSeconds, plural } from '../lib/format.ts'
import { CheckIcon } from './Icons.tsx'
import { Num } from './Num.tsx'

interface Props {
  fileName: string
  progress: Progress
  startedAt: number
  onCancel: () => void
}

type StepState = 'done' | 'active' | 'pending'

export function ProgressView({ fileName, progress, startedAt, onCancel }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [])

  const reading = progress.stage === 'reading'
  const readShare = reading && progress.total > 0 ? progress.page / progress.total : reading ? 0 : 1

  const steps: { label: string; detail: string; state: StepState }[] = [
    {
      label: 'Odczyt tekstu w przeglądarce',
      detail:
        reading && progress.total > 0
          ? `Strona ${progress.page} z ${progress.total}`
          : reading
            ? 'Otwieranie pliku'
            : 'Gotowe',
      state: reading ? 'active' : 'done',
    },
    {
      label: 'Analiza AI: podsumowanie i dane',
      detail:
        progress.stage === 'analyzing' && progress.scanPages > 0
          ? `W tym ${progress.scanPages} ${plural(progress.scanPages, 'strona skanowana', 'strony skanowane', 'stron skanowanych')}`
          : reading
            ? 'Czeka na tekst'
            : 'Model czyta dokument',
      state: reading ? 'pending' : 'active',
    },
  ]

  return (
    <section className="sheet progress" aria-labelledby="progress-title">
      <div className="progress-head">
        <h2 id="progress-title">
          Analizuję <span className="filename">„{fileName}”</span>
        </h2>
        <span className="timer" aria-hidden="true">
          <Num>{formatSeconds(now - startedAt)}</Num>
        </span>
      </div>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.label} className={`step step-${s.state}`}>
            <span className="step-marker" aria-hidden="true">
              {s.state === 'done' ? <CheckIcon width="14" height="14" /> : i + 1}
            </span>
            <div className="step-text">
              <span className="step-label">{s.label}</span>
              <span className="step-detail">{s.detail}</span>
              <span className="visually-hidden">
                {s.state === 'done'
                  ? ' (zakończono)'
                  : s.state === 'active'
                    ? ' (w toku)'
                    : ' (oczekuje)'}
              </span>
            </div>
            {s.state === 'active' && (
              <div className="meter" aria-hidden="true">
                {i === 0 ? (
                  <span className="meter-fill" style={{ transform: `scaleX(${readShare})` }} />
                ) : (
                  <span className="meter-sweep" />
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="progress-foot">
        <p>Zostaw tę kartę otwartą: przeglądarka spowalnia karty działające w tle.</p>
        <button type="button" className="button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </section>
  )
}
