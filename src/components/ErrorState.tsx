import { useEffect, useRef } from 'react'
import { AlertIcon } from './Icons.tsx'

interface Props {
  message: string
  onRetry?: () => void
  onReset: () => void
}

export function ErrorState({ message, onRetry, onReset }: Props) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [message])

  return (
    <section className="sheet error" role="alert" aria-labelledby="error-title">
      <AlertIcon className="error-icon" width="24" height="24" />
      <div className="error-body">
        <h2 id="error-title" ref={ref} tabIndex={-1}>
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
      </div>
    </section>
  )
}
