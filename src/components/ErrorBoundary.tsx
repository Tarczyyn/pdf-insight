import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * Ostatnia linia obrony przed białym ekranem: błąd renderowania (np. uszkodzony wpis
 * w localStorage) pokazuje komunikat z możliwością odświeżenia zamiast pustej strony.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console -- jedyne miejsce, gdzie błąd renderowania ma gdzie trafić
    console.error('render error', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main className="page">
        <section className="card error" role="alert">
          <h2 className="card-title">Coś poszło nie tak</h2>
          <p>Aplikacja napotkała nieoczekiwany błąd. Odśwież stronę, aby spróbować ponownie.</p>
          <div className="actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => window.location.reload()}
            >
              Odśwież stronę
            </button>
          </div>
        </section>
      </main>
    )
  }
}
