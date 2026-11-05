import type { AnalysisResult } from '@shared/schema.ts'
import { formatDate, todayIso } from '../lib/format.ts'

interface Props {
  dates: AnalysisResult['dates']
  lang: string
}

/** Daty w kolejności chronologicznej, z kreską „dziś” między tym, co minęło, a tym, co nadchodzi. */
export function DatesTimeline({ dates, lang }: Props) {
  const today = todayIso()
  const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date))
  const splitAt = sorted.findIndex((d) => d.date > today)
  const todayIndex = splitAt === -1 ? sorted.length : splitAt

  const items = sorted.map((d) => (
    <li key={`${d.date}-${d.context}`} className={d.date < today ? 'is-past' : undefined}>
      <time dateTime={d.date}>{formatDate(d.date, lang)}</time>
      <span className="ctx" lang={lang}>
        {d.context}
      </span>
    </li>
  ))
  items.splice(
    todayIndex,
    0,
    <li key="today" className="today">
      <time dateTime={today}>Dziś, {formatDate(today, 'pl')}</time>
    </li>,
  )

  return <ol className="timeline">{items}</ol>
}
