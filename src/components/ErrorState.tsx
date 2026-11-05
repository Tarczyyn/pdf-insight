import { useEffect, useRef } from 'react'

interface Props {
  message: string
  onRetry?: () => void
  onReset: () => void
}

export function ErrorState({ message, onRetry, onReset }: Props) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [message])

  return (
    <section className="card error" role="alert" aria-labelledby="error-title">
      <h2 id="error-title" className="card-title" ref={ref} tabIndex={-1}>
        Nie udało się przeanalizować dokumentu
      </h2>
      <p>{message}</p>
      <div className="actions">
        {onRetry && (
          <button type="button" className="button button-primary" onClick={onRetry}>
            Spróbuj ponownie
          </button>
        )}
        <button type="button" className="button" onClick={onReset}>
          Wybierz inny plik
        </button>
      </div>
    </section>
  )
}
