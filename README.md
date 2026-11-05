# PDF Insight

Aplikacja webowa, która wczytuje PDF, tworzy jego podsumowanie (3–5 zdań w języku dokumentu) i zamienia treść w dane JSON zgodne ze schematem z briefu.

**Demo:** https://tarczyyn.github.io/pdf-insight/

<!-- Zrzut ekranu: docs/screenshot.png (dodawany po pierwszym pełnym teście na demo) -->

## Jak działa

```
Przeglądarka (GitHub Pages)                  Supabase Edge Function "analyze"        Gemini API
1. walidacja: PDF, ≤ 10 MB, sygnatura %PDF   CORS: tylko domena demo
2. pdf.js: tekst każdej strony       ──────► limit rozmiaru i liczby żądań per IP ─► structured output
3. tekst niewidoczny → odcięty               klucz API w secrets                      (JSON Schema)
4. strony bez tekstu → JPEG                  walidacja Zod + 1 ponowna próba    ◄───
5. walidacja Zod przed wyświetleniem ◄────── oznaczenie kwot nieobecnych w tekście
6. widok, podgląd i pobranie JSON, historia
```

## Decyzje i dlaczego

| Decyzja                                                                   | Powód                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tekst wyciągany w przeglądarce** (pdf.js), do serwera idzie tylko tekst | Sam PDF nigdzie nie wychodzi, żądanie jest małe, funkcja nie parsuje binariów.                                                                                                                                                                                                                                                                                                               |
| **Ukryty tekst wykrywany po pikselach, nie tylko promptem**               | Każdy fragment tekstu jest porównywany z wyrenderowaną stroną. Jeśli w miejscu napisu nie ma kontrastu (np. biały na białym), napis jest niewidoczny dla człowieka. Taki tekst nie trafia do modelu, a użytkownik dostaje ostrzeżenie z jego treścią. Na pliku testowym łapie to instrukcję „dla systemu AI” ze str. 4 i nic poza nią (białe nagłówki na granatowych paskach tabel zostają). |
| **Prompt traktuje dokument jako dane**                                    | Treść jest w `<document>…</document>` (próby zamknięcia tagu w treści są neutralizowane), instrukcja systemowa każe ignorować polecenia z dokumentu i zgłaszać je w `warnings`. To druga warstwa obrony na wypadek tekstu, który jest widoczny.                                                                                                                                              |
| **OCR przez model multimodalny**                                          | Strona bez warstwy tekstowej jest renderowana do JPEG i idzie w tym samym wywołaniu co tekst. Bez tesseract.js (ok. 10 MB danych języka) i bez dodatkowego czasu. Maks. 5 takich stron na dokument.                                                                                                                                                                                          |
| **Weryfikacja kwot**                                                      | Serwer sprawdza, czy każda kwota z odpowiedzi występuje w warstwie tekstowej (obsługuje zapisy „184 500,00”, „4,2 mln”, liczby złamane między liniami). Kwoty, których tam nie ma (np. ze skanu), mają `verified: false` i znaczek „sprawdź” w UI.                                                                                                                                           |
| **Jeden schemat Zod** dla serwera i frontu                                | `supabase/functions/_shared/schema.ts`. Serwer waliduje odpowiedź modelu i robi 1 ponowną próbę z listą błędów; frontend waliduje wynik jeszcze raz przed wyświetleniem. Test pilnuje, żeby JSON Schema dla modelu nie rozjechał się z Zod.                                                                                                                                                  |
| **Pola i model wybrane przez serwer**                                     | `fileName` i `pages` dokłada serwer, nie model. Przy limicie lub awarii pierwszego modelu (`gemini-3.8-flash`) funkcja próbuje kolejnego (`gemini-3.5-flash-lite`), każdy ma osobny limit darmowego planu.                                                                                                                                                                                   |
| **Funkcja bez JWT** (`verify_jwt = false`)                                | We froncie nie ma żadnego klucza, nawet publicznego klucza anon. Dostęp chronią: lista dozwolonych domen, limit 6 żądań/min i 60/dzień per IP (hash IP w Postgresie), limit rozmiaru żądania. Gdy baza limitera nie odpowiada, analiza działa dalej (fail-open), żeby awaria pomocniczego elementu nie wyłączała demo.                                                                       |

### Pola dodane do schematu

Brief pozwala dodawać pola. Dodane: `amounts[].verified`, `warnings` (ukryty tekst, strony ze skanu, wykryte polecenia dla AI) i `meta` (`model`, `analyzedAt`, `ocrPages`, `hiddenTextPages`).

## Struktura

```
src/
  components/   Dropzone, ProgressView, ResultView, JsonPreview, HistoryList, ErrorState
  lib/          extractPdf (pdf.js), visibility (ukryty tekst), analyzeFile (przepływ), history, format, validateFile
  api/          analyze.ts: wywołanie funkcji, timeout, komunikaty błędów
supabase/
  functions/analyze/   index.ts (CORS, limity, Gemini, retry), prompt.ts
  functions/_shared/   schema.ts (Zod), numbers.ts (wyszukiwanie liczb w tekście)
  migrations/          tabela i funkcja limitu żądań
tests/          Vitest: schemat, liczby, prompt
```

## Uruchomienie lokalne

Wymagania: Node 24, opcjonalnie Supabase CLI i Deno do pracy nad funkcją.

```bash
npm ci
cp .env.example .env.local   # VITE_API_URL: adres funkcji
npm run dev                  # http://localhost:5173/pdf-insight/
```

Lokalna funkcja (wymaga Dockera):

```bash
echo "GEMINI_API_KEY=..." > supabase/functions/.env   # plik jest w .gitignore
supabase functions serve analyze --env-file supabase/functions/.env
# w .env.local: VITE_API_URL=http://127.0.0.1:54321/functions/v1/analyze
```

Polecenia: `npm run lint`, `npm run format:check`, `npm test`, `npm run build`.

### Zmienne środowiskowe

| Gdzie                 | Nazwa             | Opis                                                              |
| --------------------- | ----------------- | ----------------------------------------------------------------- |
| Frontend (build)      | `VITE_API_URL`    | Adres funkcji `analyze`. W GitHub Actions: zmienna repozytorium.  |
| Funkcja (secrets)     | `GEMINI_API_KEY`  | Klucz Gemini API. Ustawiany `supabase secrets set`, nigdy w repo. |
| Funkcja (opcjonalnie) | `GEMINI_MODELS`   | Lista modeli po przecinku, w kolejności prób.                     |
| Funkcja (opcjonalnie) | `ALLOWED_ORIGINS` | Dozwolone domeny, po przecinku.                                   |

## Deploy

- **Frontend:** push na `main` → GitHub Actions: lint › formatowanie › testy › build › typecheck funkcji › deploy na Pages.
- **Funkcja:** `supabase functions deploy analyze --use-api` i `supabase db push` dla migracji.

## Bezpieczeństwo

- Klucz API tylko w secrets Supabase; w repo jest wyłącznie `.env.example`.
- CORS i sprawdzenie nagłówka `Origin`: domena demo i localhost.
- Limity: 10 MB pliku, ok. 9 MB żądania, 400 tys. znaków tekstu, 5 stron ze skanu, liczba żądań per IP.
- Treść PDF to dane: ukryty tekst odcinany przed modelem, dokument w ograniczniku, polecenia z dokumentu zgłaszane w `warnings`.
- Bez `dangerouslySetInnerHTML` (reguła ESLint); JSON wyświetlany jako tekst.
- Użytkownik widzi przed wgraniem, co i dokąd jest wysyłane.

## Znane ograniczenia

- **Darmowy plan Gemini** ma niskie dzienne limity i Google może wykorzystywać przesłane dane. Przy wyczerpaniu limitu aplikacja pokazuje komunikat i propozycję ponowienia.
- **OCR** obejmuje maks. 5 stron bez warstwy tekstowej; dane ze skanów są oznaczone jako niezweryfikowane.
- **Wykrywanie ukrytego tekstu** działa dla pierwszych 60 stron (dalej tylko kontrola położenia poza stroną). Nie wykrywa tekstu przykrytego innym obiektem, jeśli obiekt ma kontrast.
- **Długie dokumenty** (powyżej 400 tys. znaków) są odrzucane.
- Podsumowanie i dane pochodzą z modelu językowego; aplikacja ogranicza zmyślenia (walidacja, weryfikacja kwot), ale ich nie wyklucza.
