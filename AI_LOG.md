# AI_LOG

## Narzędzia

- **Claude Code** (aplikacja desktopowa, model Claude Opus 5.5): research dokumentów, plan, kod, testy, deploy z terminala.
- **Google Gemini API** (darmowy plan): model, który w aplikacji robi podsumowanie i ekstrakcję danych.
- Weryfikacja ręczna: przeglądarka (podgląd aplikacji, 360 px), `curl` na funkcję, przeliczenia kwot.

## Kluczowe prompty

1. **Research przed kodem.** „Zrób mi research bez AI slop, zapoznaj się dokładnie z tymi dokumentami” (brief + umowa testowa) wraz z moją listą czterech podejrzeń: injection na str. 4, skan aneksu na str. 11, wiele walut na str. 3–8, angielski fragment na str. 10. Wynik: [docs/RESEARCH.md](docs/RESEARCH.md). Potwierdził moje tezy i dorzucił rzeczy, których nie zauważyłem (biały tekst 5 pt, liczby złamane między liniami, odmiana nazwisk, niespójności w samej umowie).
2. **Plan zamiast kodu od razu.** „Najpierw plan” → [docs/PLAN.md](docs/PLAN.md) z kolejnością MUST → SHOULD i budżetem czasu. Decyzje podjąłem sam: Gemini (darmowy), OCR przez obraz strony, Supabase zamiast Cloudflare, nowy projekt Supabase.
3. **Obrona przed injection w kodzie, nie tylko w prompcie.** Zamiast polegać na instrukcji „ignoruj polecenia z dokumentu”, ukryty tekst wykrywamy porównując warstwę tekstową z wyrenderowaną stroną i odcinamy go, zanim trafi do modelu.
4. **Prompt systemowy funkcji** ([supabase/functions/analyze/prompt.ts](supabase/functions/analyze/prompt.ts)): dokument jako dane w `<document>`, zakaz liczenia i przeliczania walut, nazwiska w mianowniku, kontekst przy kwotach, które nie są ceną (kapitał, budżet, szacunki).
5. **Diagnoza zamiast zgadywania.** Gdy funkcja zwracała tylko „usługa AI odrzuciła żądanie”, poprosiłem o dodanie do odpowiedzi statusu dostawcy. Od razu wyszło: najpierw 401 (zły klucz), potem 503 i timeouty (przeciążony darmowy model).

## Gdzie AI się pomyliło i jak to poprawiłem

| Problem                                                                                                                                  | Jak wyszedł                         | Poprawka                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Szablon Vite postawił TypeScript 7 i oxlint, a brief wymaga ESLint; typescript-eslint obsługuje TS < 6.1                                 | sprawdzenie wersji przed instalacją | TypeScript 6.0 + ESLint 10                                                                                            |
| Pierwszy licznik zdań „sklejał” zdania kończące się na „r.” („…2028 r. Abonament…”), więc 4-zdaniowe podsumowanie mogło zostać odrzucone | przegląd kodu przed testami         | nowy algorytm: granica = kropka + wielka litera, z wyjątkiem skrótów typu „ul.”, „art.”; testy na przykładach z umowy |
| Prettier zamienił zapis twardej spacji (kod U+00A0) w wyrażeniu regularnym na niewidoczny znak                                           | podgląd diffu (`od -c`)             | `\s` zamiast listy znaków                                                                                             |
| Ukryty tekst w ostrzeżeniu miał spacje w środku słów („wcze ś niejsze”), bo pdf.js dzieli polskie znaki na osobne elementy               | test w przeglądarce na umowie       | odstępy przypisywane do bieżącego ciągu (widocznego lub ukrytego)                                                     |
| `pdf.destroy()` nie istnieje w pdf.js 6                                                                                                  | `tsc`                               | `loadingTask.destroy()`                                                                                               |
| Domyślny model `gemini-3.8-flash` nie odpowiadał w 25 s nawet na krótką fakturę, a `gemini-3.5-flash-lite` zwracał 503 „high demand”     | test `curl` z diagnostyką           | niski poziom „thinking”, lista 5 modeli z przejściem na kolejny, łączny budżet 55 s                                   |
| Model zwracał tylko 6 kwot z umowy (bez etapów, VAT, zaliczki, kar)                                                                      | pełny test na umowie                | doprecyzowany opis pola `amounts` w prompcie → 16 kwot, kwoty-pułapki z poprawnym kontekstem                          |
| Tabele wyników na 360 px przewijały się w bok, kolumna kontekstu nieczytelna                                                             | podgląd w przeglądarce 360 px       | wiersze jako karty na wąskim ekranie                                                                                  |

## Czego AI nie robiło

Klucz Gemini wpisałem sam (panel Supabase); AI nie miało do niego dostępu. Decyzje o dostawcy, backendzie, organizacji Supabase i upublicznieniu repo podejmowałem ja.
