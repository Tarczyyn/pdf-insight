import { useMemo, useState } from 'react'
import type { AnalysisResult } from '@shared/schema.ts'
import { formatAmountNumber } from '../lib/format.ts'
import { Num } from './Num.tsx'

interface Props {
  amounts: AnalysisResult['amounts']
  lang: string
  headingId: string
}

export function AmountsLedger({ amounts, lang, headingId }: Props) {
  const [currency, setCurrency] = useState<string | null>(null)

  // Waluty w kolejności częstości: przy umowie z PLN, EUR i USD najczęstsza idzie pierwsza.
  const currencies = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of amounts) counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [amounts])

  const active = currency !== null && currencies.some(([c]) => c === currency) ? currency : null
  const rows = active ? amounts.filter((a) => a.currency === active) : amounts
  const unverified = amounts.filter((a) => !a.verified).length

  return (
    <>
      {currencies.length > 1 && (
        <div className="segmented" role="group" aria-label="Filtruj kwoty według waluty">
          <button type="button" aria-pressed={active === null} onClick={() => setCurrency(null)}>
            Wszystkie <span className="count">{amounts.length}</span>
          </button>
          {currencies.map(([code, n]) => (
            <button
              key={code}
              type="button"
              aria-pressed={active === code}
              onClick={() => setCurrency(code)}
            >
              {code} <span className="count">{n}</span>
            </button>
          ))}
        </div>
      )}
      <div className="ledger-wrap" tabIndex={0} role="region" aria-labelledby={headingId}>
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col" className="num">
                Kwota
              </th>
              <th scope="col">Waluta</th>
              <th scope="col">Czego dotyczy</th>
            </tr>
          </thead>
          <tbody lang={lang}>
            {rows.map((a) => (
              <tr key={`${a.value}-${a.currency}-${a.context}`}>
                <td className="num">
                  {a.verified ? (
                    <Num>{formatAmountNumber(a.value, a.currency, lang)}</Num>
                  ) : (
                    <>
                      <mark>
                        <Num>{formatAmountNumber(a.value, a.currency, lang)}</Num>
                      </mark>
                      <span className="flag" title="Wartości nie ma w warstwie tekstowej PDF">
                        sprawdź
                      </span>
                    </>
                  )}
                </td>
                <td className="code">{a.currency}</td>
                <td className="ctx">{a.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unverified > 0 && (
        <p className="footnote">
          <mark>Zaznaczone</mark> kwoty nie występują w warstwie tekstowej PDF (np. pochodzą ze
          skanu). Porównaj je z oryginałem.
        </p>
      )}
    </>
  )
}
