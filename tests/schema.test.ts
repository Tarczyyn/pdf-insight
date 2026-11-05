import { describe, expect, it } from 'vitest'
import {
  aiOutputSchema,
  analysisResultSchema,
  countSentences,
  isIsoCurrency,
  isIsoDate,
  type AnalysisResult,
} from '@shared/schema.ts'

const validResult: AnalysisResult = {
  document: {
    fileName: 'umowa.pdf',
    pages: 12,
    language: 'pl',
    type: 'umowa',
    title: 'Umowa ramowa nr 14/2026',
    date: '2026-03-12',
  },
  summary:
    'Umowa dotyczy wdrożenia systemu CRM. Wynagrodzenie za wdrożenie wynosi 184 500 zł netto. Umowa obowiązuje do 31 marca 2028 r.',
  keyPoints: ['Okres 24 mies.', 'SLA 99,5%', 'Abonament 12 300 zł netto'],
  entities: { organizations: ['Nordwave Logistics sp. z o.o.'], people: ['Anna Kowalczyk'] },
  amounts: [
    { value: 184500, currency: 'PLN', context: 'wynagrodzenie za wdrożenie', verified: true },
  ],
  dates: [{ date: '2026-04-01', context: 'początek obowiązywania' }],
  keywords: ['CRM', 'SLA'],
  warnings: [],
  meta: {
    model: 'gemini-3.8-flash',
    analyzedAt: '2026-11-05T18:00:00.000Z',
    ocrPages: [11],
    hiddenTextPages: [4],
  },
}

function clone(): AnalysisResult {
  return structuredClone(validResult)
}

describe('analysisResultSchema', () => {
  it('przyjmuje poprawny wynik', () => {
    expect(analysisResultSchema.safeParse(validResult).success).toBe(true)
  })

  it('przyjmuje brak danych jako null i puste tablice', () => {
    const r = clone()
    r.document.title = null
    r.document.date = null
    r.entities = { organizations: [], people: [] }
    r.amounts = []
    r.dates = []
    r.keywords = []
    expect(analysisResultSchema.safeParse(r).success).toBe(true)
  })

  it('odrzuca walutę spoza ISO 4217', () => {
    for (const bad of ['zł', 'pln', 'ZLO', 'EURO']) {
      const r = clone()
      r.amounts = [{ value: 1, currency: bad, context: 'x', verified: true }]
      expect(analysisResultSchema.safeParse(r).success, bad).toBe(false)
    }
  })

  it('odrzuca datę w formacie innym niż ISO 8601 albo nieistniejącą', () => {
    for (const bad of ['12.03.2026', '2026-3-12', '2026-02-30', '2026-13-01']) {
      const r = clone()
      r.dates = [{ date: bad, context: 'x' }]
      expect(analysisResultSchema.safeParse(r).success, bad).toBe(false)
    }
  })

  it('odrzuca nieznany typ dokumentu', () => {
    const r = clone() as unknown as { document: { type: string } }
    r.document.type = 'kontrakt'
    expect(analysisResultSchema.safeParse(r).success).toBe(false)
  })

  it('wymaga 3–7 punktów kluczowych', () => {
    const r = clone()
    r.keyPoints = ['a', 'b']
    expect(analysisResultSchema.safeParse(r).success).toBe(false)
    r.keyPoints = ['1', '2', '3', '4', '5', '6', '7', '8']
    expect(analysisResultSchema.safeParse(r).success).toBe(false)
  })

  it('wymaga 3–5 zdań podsumowania', () => {
    const r = clone()
    r.summary = 'Jedno zdanie.'
    expect(analysisResultSchema.safeParse(r).success).toBe(false)
    r.summary = 'A jest. B jest. C jest. D jest. E jest. F jest.'
    expect(analysisResultSchema.safeParse(r).success).toBe(false)
  })

  it('odrzuca brakujące wymagane pole', () => {
    const r = clone() as Partial<AnalysisResult>
    delete r.summary
    expect(analysisResultSchema.safeParse(r).success).toBe(false)
  })

  it('odrzuca kod języka spoza ISO 639-1', () => {
    const r = clone()
    r.document.language = 'polski'
    expect(analysisResultSchema.safeParse(r).success).toBe(false)
  })
})

describe('aiOutputSchema', () => {
  it('nie przyjmuje pól, które dokłada serwer, jako wymaganych', () => {
    const { document, summary, keyPoints, entities, dates, keywords, warnings } = validResult
    const ai = {
      document: {
        language: document.language,
        type: document.type,
        title: document.title,
        date: document.date,
      },
      summary,
      keyPoints,
      entities,
      amounts: [{ value: 12300, currency: 'PLN', context: 'abonament' }],
      dates,
      keywords,
      warnings,
    }
    expect(aiOutputSchema.safeParse(ai).success).toBe(true)
  })
})

describe('countSentences', () => {
  it('nie dzieli zdania na skrótach i datach', () => {
    expect(countSentences('Spółka ma siedzibę przy ul. Portowa 18 w Gdańsku.')).toBe(1)
    expect(countSentences('Umowę zawarto 12.03.2026 r. w Gdańsku.')).toBe(1)
    expect(countSentences('Strony zawrą umowę zgodnie z art. 28 RODO.')).toBe(1)
    expect(countSentences('Zamawiający to Nordwave Logistics sp. z o.o. z Gdańska.')).toBe(1)
  })

  it('liczy zdanie kończące się na „r.”', () => {
    expect(countSentences('Umowa obowiązuje do 31 marca 2028 r. Abonament wynosi 12 300 zł.')).toBe(
      2,
    )
  })

  it('liczy typowe podsumowanie', () => {
    expect(countSentences(validResult.summary)).toBe(3)
    expect(countSentences('')).toBe(0)
  })
})

describe('helpery formatów', () => {
  it('ISO 4217', () => {
    expect(isIsoCurrency('PLN')).toBe(true)
    expect(isIsoCurrency('USD')).toBe(true)
    expect(isIsoCurrency('XYZ')).toBe(false)
  })
  it('ISO 8601', () => {
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2027-02-29')).toBe(false)
  })
})
