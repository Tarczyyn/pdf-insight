import { useCallback, useRef, useState } from 'react'
import type { AnalysisResult } from '@shared/schema.ts'
import { Dropzone } from './components/Dropzone.tsx'
import { ErrorState } from './components/ErrorState.tsx'
import { HistoryList } from './components/HistoryList.tsx'
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
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            PI
          </span>
          <div>
            <h1>PDF Insight</h1>
            <p className="muted">Podsumowanie i dane z dokumentu PDF w kilka sekund</p>
          </div>
        </div>
      </header>

      <div className="layout">
        <main id="main" className="main">
          <div aria-live="polite" className="visually-hidden">
            {state.status === 'working' && 'Trwa analiza dokumentu.'}
            {state.status === 'done' && 'Analiza zakończona.'}
          </div>

          {state.status !== 'working' && (
            <section
              aria-label="Wgrywanie pliku"
              className={state.status === 'idle' ? 'intro' : ''}
            >
              {state.status === 'idle' && (
                <div className="empty">
                  <h2>Wgraj dokument, aby zacząć</h2>
                  <p className="muted">
                    Dostaniesz streszczenie w 3–5 zdaniach, najważniejsze punkty, kwoty, daty, osoby
                    i organizacje oraz plik JSON do pobrania.
                  </p>
                </div>
              )}
              <Dropzone onFile={run} disabled={working} compact={state.status === 'done'} />
              <p className="privacy small">
                <strong>Gdzie trafia plik:</strong> PDF jest odczytywany w Twojej przeglądarce. Do
                analizy wysyłamy tylko jego tekst (a strony bez tekstu jako obrazy) przez nasz
                serwer do Google Gemini API. Na darmowym planie Google może wykorzystywać przesłane
                dane do ulepszania swoich usług, więc nie wgrywaj dokumentów z danymi poufnymi.
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

      <footer className="site-footer muted small">
        Zadanie rekrutacyjne Vibe Coder ·{' '}
        <a href="https://github.com/Tarczyyn/pdf-insight">kod źródłowy</a>
      </footer>
    </div>
  )
}
