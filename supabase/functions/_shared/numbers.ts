// Wyciąga z tekstu wszystkie wartości liczbowe w zapisach spotykanych w dokumentach:
// "184 500,00", "12 300", "1.250,50", "1,250.50", "0,2", "4,2 mln", "890".
// Służy do sprawdzenia, czy kwota zwrócona przez model rzeczywiście występuje w dokumencie.

const MULTIPLIERS: Record<string, number> = {
  tys: 1_000,
  tysięcy: 1_000,
  tysiące: 1_000,
  k: 1_000,
  mln: 1_000_000,
  miliona: 1_000_000,
  milionów: 1_000_000,
  million: 1_000_000,
  m: 1_000_000,
  mld: 1_000_000_000,
  miliarda: 1_000_000_000,
  billion: 1_000_000_000,
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Zamienia jeden zapis liczby na wartość; zwraca kilka kandydatów, gdy zapis jest niejednoznaczny. */
export function parseNumberToken(raw: string): number[] {
  const token = raw.replace(/\s/g, '')
  const out: number[] = []
  const hasComma = token.includes(',')
  const hasDot = token.includes('.')
  if (hasComma && hasDot) {
    // Ostatni separator to część dziesiętna.
    const decimalSep = token.lastIndexOf(',') > token.lastIndexOf('.') ? ',' : '.'
    const thousandSep = decimalSep === ',' ? '.' : ','
    out.push(Number(token.split(thousandSep).join('').replace(decimalSep, '.')))
  } else if (hasComma) {
    const parts = token.split(',')
    // "1,250" może być tysiącem (zapis angielski) albo 1,25 (zapis polski).
    if (parts.length === 2) out.push(Number(parts.join('.')))
    if (parts.slice(1).every((p) => p.length === 3)) out.push(Number(parts.join('')))
  } else if (hasDot) {
    const parts = token.split('.')
    if (parts.length === 2) out.push(Number(token))
    if (parts.slice(1).every((p) => p.length === 3)) out.push(Number(parts.join('')))
  } else {
    out.push(Number(token))
  }
  return out.filter((n) => Number.isFinite(n)).map(round2)
}

// Grupy tysięcy oddzielone białym znakiem (spacja, twarda spacja, nowa linia, bo pdf.js potrafi
// złamać "295 200,00" na dwie linie), opcjonalna część dziesiętna, opcjonalny mnożnik.
const NUMBER_RE = /\d{1,3}(?:[\s.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g
const MULTIPLIER_RE =
  /^\s*(tys(?:ięcy|iące)?|mln|miliona|milionów|million|mld|miliarda|billion|k|m)\b\.?/i

export function extractNumbers(text: string): Set<number> {
  const values = new Set<number>()
  for (const match of text.matchAll(NUMBER_RE)) {
    const raw = match[0]
    const candidates = parseNumberToken(raw)
    // Wariant bez łączenia grup: "1 250 1 250" w spłaszczonej tabeli to dwie liczby.
    for (const piece of raw.split(/\s/)) {
      candidates.push(...parseNumberToken(piece))
    }
    const after = text.slice((match.index ?? 0) + raw.length, (match.index ?? 0) + raw.length + 12)
    const mult = MULTIPLIER_RE.exec(after)
    const factor = mult?.[1] ? MULTIPLIERS[mult[1].toLowerCase()] : undefined
    for (const value of candidates) {
      values.add(value)
      if (factor) values.add(round2(value * factor))
    }
  }
  return values
}

/** Czy wartość występuje w tekście (z tolerancją na zaokrąglenie do grosza). */
export function isValueInText(value: number, numbers: Set<number>): boolean {
  return numbers.has(round2(Math.abs(value)))
}
