import { useId, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { FileUpIcon } from './Icons.tsx'

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

  // Klik w dowolne miejsce strefy otwiera wybór pliku; z klawiatury działa przycisk.
  const onZoneClick = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled || (e.target as HTMLElement).closest('button')) return
    inputRef.current?.click()
  }

  return (
    <div
      className={`dropzone${dragging ? ' is-dragging' : ''}${compact ? ' is-compact' : ''}`}
      onClick={onZoneClick}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {!compact && <FileUpIcon className="dropzone-icon" width="28" height="28" />}
      <p className="dropzone-title">
        {dragging
          ? 'Upuść plik, aby go przeanalizować'
          : compact
            ? 'Przeciągnij kolejny PDF albo'
            : 'Przeciągnij tu plik PDF albo'}
      </p>
      <button
        type="button"
        className={`button ${compact ? '' : 'button-primary'}`}
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
