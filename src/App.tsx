import { useCallback, useRef, useState } from 'react'
import type { AnalysisResult } from '@shared/schema.ts'
import { Dropzone } from './components/Dropzone.tsx'
import { ErrorState } from './components/ErrorState.tsx'
import { HistoryList } from './components/HistoryList.tsx'
import { BrandMark } from './components/Icons.tsx'
import { ProgressView } from './components/ProgressView.tsx'
import { ResultView } from './components/ResultView.tsx'
import { AnalysisError, analyzeFile, type Progress } from './lib/analyzeFile.ts'
import { clearHistory, loadHistory, saveToHistory, type HistoryEntry } from './lib/history.ts'
import { validatePdfFile } from './lib/validateFile.ts'

type State =
  | { status: 'idle' }
  | { status: 'working'; file: File; progress: Progress; startedAt: number }
  | { status: 'done'; entryId: string; result: AnalysisResult; durationMs: number }
  | { status: 'error'; message: string; retryFile: File | null }

export default function App() {
  const [state, setState] = useState<State>({ status: 'idle' })
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (file: File) => {
    const check = await validatePdfFile(file)
    if (!check.ok) {
      setState({ status: 'error', message: check.message, retryFile: null })
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const startedAt = Date.now()
    setState({
      status: 'working',
      file,
      startedAt,
      progress: { stage: 'reading', page: 0, total: 0 },
    })
    try {
      const result = await analyzeFile(
        file,
        (progress) => {
          if (!controller.signal.aborted) {
            setState((s) => (s.status === 'working' ? { ...s, progress } : s))
          }
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      const durationMs = Date.now() - startedAt
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        durationMs,
        result,
      }
      setHistory(saveToHistory(entry))
      setState({ status: 'done', entryId: entry.id, result, durationMs })
    } catch (error) {
      if (controller.signal.aborted) return
      const message =
        error instanceof AnalysisError ? error.userMessage : 'Wystąpił nieoczekiwany błąd.'
      const retryable = error instanceof AnalysisError ? error.retryable : true
      setState({ status: 'error', message, retryFile: retryable ? file : null })
    }
  }, [])

  const cancel = () => {
    abortRef.current?.abort()
    setState({ status: 'idle' })
  }

  const working = state.status === 'working'

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        Przejdź do treści
      </a>
      <header className="site-header">
        <BrandMark />
        <div>
          <h1>PDF Insight</h1>
          <p>Streszczenie i dane z dokumentu PDF</p>
        </div>
      </header>

      <div className="layout">
        <main id="main" className="main">
          <div aria-live="polite" className="visually-hidden">
            {state.status === 'working' && 'Trwa analiza dokumentu.'}
            {state.status === 'done' && 'Analiza zakończona.'}
          </div>

          {state.status === 'idle' && (
            <section className="intake" aria-labelledby="intake-title">
              <div className="intake-copy">
                <h2 id="intake-title">Wgraj PDF, a dostaniesz streszczenie i dane w JSON</h2>
                <p>
                  Streszczenie w 3–5 zdaniach w języku dokumentu, najważniejsze punkty, kwoty, daty,
                  osoby i organizacje oraz plik JSON do pobrania.
                </p>
              </div>
              <Dropzone onFile={run} disabled={working} />
              <PrivacyFlow />
            </section>
          )}

          {(state.status === 'done' || state.status === 'error') && (
            <section aria-label="Wgrywanie pliku" className="intake-compact">
              <Dropzone onFile={run} disabled={working} compact />
              <p className="privacy-line">
                Tekst PDF trafia przez nasz serwer do Google Gemini API. Nie wgrywaj dokumentów z
                danymi poufnymi.
              </p>
            </section>
          )}

          {state.status === 'working' && (
            <ProgressView
              fileName={state.file.name}
              progress={state.progress}
              startedAt={state.startedAt}
              onCancel={cancel}
            />
          )}

          {state.status === 'error' && (
            <ErrorState
              message={state.message}
              onRetry={state.retryFile ? () => void run(state.retryFile as File) : undefined}
              onReset={() => setState({ status: 'idle' })}
            />
          )}

          {state.status === 'done' && (
            <ResultView result={state.result} durationMs={state.durationMs} />
          )}
        </main>

        <aside className="sidebar">
          <HistoryList
            entries={history}
            activeId={state.status === 'done' ? state.entryId : null}
            onOpen={(e) =>
              setState({
                status: 'done',
                entryId: e.id,
                result: e.result,
                durationMs: e.durationMs,
              })
            }
            onClear={() => {
              clearHistory()
              setHistory([])
            }}
          />
        </aside>
      </div>

      <footer className="site-footer">
        Zadanie rekrutacyjne Vibe Coder ·{' '}
        <a href="https://github.com/Tarczyyn/pdf-insight">kod źródłowy</a>
      </footer>
    </div>
  )
}

/** Informacja przed wgraniem: co dzieje się z plikiem na każdym etapie. */
function PrivacyFlow() {
  return (
    <section className="privacy" aria-labelledby="privacy-title">
      <h3 id="privacy-title">Dokąd trafia plik</h3>
      <ol>
        <li>
          <strong>Twoja przeglądarka</strong>
          <span>Odczytuje PDF. Sam plik nie jest nigdzie wysyłany.</span>
        </li>
        <li>
          <strong>Nasz serwer</strong>
          <span>Przekazuje tekst, a strony bez tekstu jako obrazy, do Google Gemini API.</span>
        </li>
        <li>
          <strong>Google Gemini</strong>
          <span>
            Na darmowym planie Google może wykorzystywać przesłane dane do ulepszania swoich usług.
            Nie wgrywaj dokumentów z danymi poufnymi.
          </span>
        </li>
      </ol>
    </section>
  )
}
