import { describe, expect, it } from 'vitest'
import { extractNumbers, isValueInText, parseNumberToken } from '@shared/numbers.ts'

describe('parseNumberToken', () => {
  it('czyta zapis polski i angielski', () => {
    expect(parseNumberToken('184 500,00')).toContain(184500)
    expect(parseNumberToken('1.250,50')).toContain(1250.5)
    expect(parseNumberToken('1,250.50')).toContain(1250.5)
    expect(parseNumberToken('0,2')).toContain(0.2)
  })
})

describe('extractNumbers', () => {
  // Fragmenty dosłownie z warstwy tekstowej umowy testowej (wynik pdf.js).
  const text = [
    'wynagrodzenie ryczałtowe w wysokości 184 500,00',
    'zł netto (słownie: sto osiemdziesiąt cztery tysiące pięćset złotych 00/100)',
    'abonament 12 300,00 zł/mies. (295',
    '200,00 zł za 24 miesiące) · licencje 8 600 EUR/rok · hosting 890 USD/mies.',
    'Zgłoszenia klientów miesięcznie 1 250 1 250 0%',
    'przy założeniu wzrostu przychodów o 4,2',
    'mln zł rocznie.',
  ].join('\n')
  const numbers = extractNumbers(text)

  it('znajduje kwoty z separatorem tysięcy', () => {
    for (const v of [184500, 12300, 8600, 890])
      expect(isValueInText(v, numbers), String(v)).toBe(true)
  })

  it('skleja liczbę złamaną na dwie linie', () => {
    expect(isValueInText(295200, numbers)).toBe(true)
  })

  it('rozdziela komórki spłaszczonej tabeli', () => {
    expect(isValueInText(1250, numbers)).toBe(true)
  })

  it('uwzględnia mnożnik "mln"', () => {
    expect(isValueInText(4200000, numbers)).toBe(true)
  })

  it('nie znajduje kwoty, której nie ma w tekście', () => {
    expect(isValueInText(13100, numbers)).toBe(false)
    expect(isValueInText(226935, numbers)).toBe(false)
  })
})
