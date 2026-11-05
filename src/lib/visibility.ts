// Czyste funkcje do oceny, czy fragment tekstu jest widoczny dla człowieka.
// Pomysł: renderujemy stronę tak, jak zobaczy ją użytkownik, i sprawdzamy piksele pod
// prostokątem, w którym według warstwy tekstowej stoi dany napis. Jeśli obszar jest
// jednolity (np. biały tekst na białym tle), napisu nie widać, choć model by go przeczytał.

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Rozpiętość jasności (0–255) w obszarze RGBA. 0 = obszar idealnie jednolity. */
export function luminanceRange(rgba: Uint8ClampedArray): number {
  let min = 255
  let max = 0
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i] ?? 0
    const g = rgba[i + 1] ?? 0
    const b = rgba[i + 2] ?? 0
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (lum < min) min = lum
    if (lum > max) max = lum
  }
  return rgba.length < 4 ? 0 : max - min
}

/** Próg dobrany tak, by jasnoszary tekst (np. #8a8a8a w stopce) nadal liczył się jako widoczny. */
export const INVISIBLE_RANGE_THRESHOLD = 12

/** Napis jest niewidoczny, gdy leży poza stroną albo pod nim nie ma żadnego kontrastu. */
export function isBoxInvisible(
  box: Box,
  pageWidth: number,
  pageHeight: number,
  pixelRange: number | null,
): boolean {
  const outside =
    box.x + box.width <= 0 || box.y + box.height <= 0 || box.x >= pageWidth || box.y >= pageHeight
  if (outside) return true
  if (box.width < 0.5 || box.height < 0.5) return true
  return pixelRange !== null && pixelRange < INVISIBLE_RANGE_THRESHOLD
}

/** Przycina prostokąt do strony i zaokrągla do pełnych pikseli. */
export function clampBox(box: Box, pageWidth: number, pageHeight: number): Box | null {
  const x = Math.max(0, Math.floor(box.x))
  const y = Math.max(0, Math.floor(box.y))
  const right = Math.min(pageWidth, Math.ceil(box.x + box.width))
  const bottom = Math.min(pageHeight, Math.ceil(box.y + box.height))
  if (right - x < 1 || bottom - y < 1) return null
  return { x, y, width: right - x, height: bottom - y }
}
