import { AlertIcon, EyeOffIcon, ScanIcon } from './Icons.tsx'

interface Props {
  warnings: string[]
  headingId: string
}

// Ostrzeżenie o ukrytym tekście składa analyzeFile: „…Treść: „<tekst>””.
// Rozbijamy je, żeby pominięty fragment pokazać jako przekreślony cytat, a nie zwykłe zdanie.
const HIDDEN_TEXT = /^([\s\S]*?)\s*Treść: „([\s\S]*)”$/
const SCAN = /skan|warstwy tekstowej|obrazu/i

function Note({ text }: { text: string }) {
  const hidden = HIDDEN_TEXT.exec(text)
  if (hidden) {
    return (
      <li className="note note-hidden">
        <EyeOffIcon className="note-icon" />
        <div className="note-body">
          <p>{hidden[1]}</p>
          <figure className="omitted">
            <figcaption>Pominięty fragment</figcaption>
            <blockquote>
              <s>{hidden[2]}</s>
            </blockquote>
          </figure>
        </div>
      </li>
    )
  }
  const Icon = SCAN.test(text) ? ScanIcon : AlertIcon
  return (
    <li className="note">
      <Icon className="note-icon" />
      <div className="note-body">
        <p>{text}</p>
      </div>
    </li>
  )
}

export function Notes({ warnings, headingId }: Props) {
  return (
    <section className="row row-notes" aria-labelledby={headingId}>
      <h3 id={headingId} className="row-label">
        Uwagi <span className="count">{warnings.length}</span>
      </h3>
      <ul className="row-body notes">
        {warnings.map((w) => (
          <Note key={w} text={w} />
        ))}
      </ul>
    </section>
  )
}
