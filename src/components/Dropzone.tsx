import { useId, useRef, useState, type DragEvent } from 'react'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
  compact?: boolean
}

export function Dropzone({ onFile, disabled = false, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file && !disabled) onFile(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files)
  }

  return (
    <div
      className={`dropzone${dragging ? ' is-dragging' : ''}${compact ? ' is-compact' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <svg className="dropzone-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M12 18v-6 M9.5 14.5 12 12l2.5 2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="dropzone-title">
        {compact ? 'Przeciągnij kolejny PDF albo' : 'Przeciągnij plik PDF tutaj albo'}
      </p>
      <button
        type="button"
        className="button button-primary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-describedby={hintId}
      >
        Wybierz plik
      </button>
      <p id={hintId} className="dropzone-hint">
        Tylko PDF, maksymalnie 10 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          pick(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
