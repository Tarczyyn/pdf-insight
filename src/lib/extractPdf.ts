import { GlobalWorkerOptions, Util, getDocument } from 'pdfjs-dist'
import type { PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { LIMITS } from '@shared/schema.ts'
import { PdfReadError } from './pdfReadError.ts'
import { clampBox, isBoxInvisible, luminanceRange, type Box } from './visibility.ts'

// Worker pdf.js jako osobny plik z bundla: Vite nadaje mu ścieżkę z prefiksem base
// ("/pdf-insight/assets/..."), więc działa także pod adresem GitHub Pages.
GlobalWorkerOptions.workerSrc = workerUrl

/** Skala renderowania: 1,5 × 72 dpi ≈ 108 dpi. Wystarcza do odczytu skanu i oceny widoczności. */
const RENDER_SCALE = 1.5
/** Strona z mniejszą liczbą znaków (bez białych) traktowana jest jako możliwy skan. */
const SCAN_TEXT_THRESHOLD = 20
/** Powyżej tej liczby stron pomijamy render i kontrolę pikseli, żeby zmieścić się w czasie. */
const MAX_RENDERED_PAGES = 60
const JPEG_QUALITY = 0.75

export interface ExtractedPdf {
  pageCount: number
  pages: { page: number; text: string }[]
  images: { page: number; mimeType: 'image/jpeg'; data: string }[]
  hiddenText: { page: number; text: string }[]
  /** Strony bez warstwy tekstowej, których nie wysłano (limit skanów). */
  skippedScanPages: number[]
  /** Strony, na których nie sprawdzono widoczności tekstu (bardzo długie dokumenty). */
  uncheckedPages: number[]
  textChars: number
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === 'object' && item !== null && 'str' in item && 'transform' in item
}

interface Rendered {
  canvas: HTMLCanvasElement
  pixels: Uint8ClampedArray
  width: number
  height: number
}

async function renderPage(page: PDFPageProxy): Promise<Rendered> {
  const viewport = page.getViewport({ scale: RENDER_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new PdfReadError('Przeglądarka nie udostępnia płótna (canvas) do odczytu PDF.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, viewport }).promise
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  return { canvas, pixels, width: canvas.width, height: canvas.height }
}

/** Wycina z pełnego bufora RGBA strony prostokąt i liczy rozpiętość jasności. */
function regionRange(r: Rendered, box: Box): number | null {
  const clamped = clampBox(box, r.width, r.height)
  if (!clamped) return null
  const region = new Uint8ClampedArray(clamped.width * clamped.height * 4)
  for (let row = 0; row < clamped.height; row++) {
    const start = ((clamped.y + row) * r.width + clamped.x) * 4
    region.set(r.pixels.subarray(start, start + clamped.width * 4), row * clamped.width * 4)
  }
  return luminanceRange(region)
}

function toBase64Jpeg(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

export async function extractPdf(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<ExtractedPdf> {
  const data = new Uint8Array(await file.arrayBuffer())

  const loadingTask = getDocument({ data })
  let pdf
  try {
    pdf = await loadingTask.promise
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'PasswordException') {
      throw new PdfReadError(
        'Plik jest zabezpieczony hasłem. Usuń hasło i spróbuj ponownie.',
        error,
      )
    }
    throw new PdfReadError('Nie udało się otworzyć pliku. Upewnij się, że to poprawny PDF.', error)
  }

  const result: ExtractedPdf = {
    pageCount: pdf.numPages,
    pages: [],
    images: [],
    hiddenText: [],
    skippedScanPages: [],
    uncheckedPages: [],
    textChars: 0,
  }

  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      onProgress?.(n, pdf.numPages)
      const page = await pdf.getPage(n)
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      const content = await page.getTextContent()
      const rendered = n <= MAX_RENDERED_PAGES ? await renderPage(page) : null
      if (!rendered) result.uncheckedPages.push(n)

      let visible = ''
      let hidden = ''
      // Odstępy między słowami są osobnymi elementami; przypisujemy je do bieżącego ciągu.
      let inHiddenRun = false
      for (const item of content.items) {
        if (!isTextItem(item)) continue
        const eol = item.hasEOL ? '\n' : ''
        if (item.str.trim() === '') {
          if (inHiddenRun) hidden += item.str + eol
          else visible += item.str + eol
          continue
        }
        const tx = Util.transform(viewport.transform, item.transform) as number[]
        const fontHeight = Math.hypot(tx[2] ?? 0, tx[3] ?? 0)
        const box: Box = {
          x: tx[4] ?? 0,
          y: (tx[5] ?? 0) - fontHeight,
          width: item.width * RENDER_SCALE,
          height: fontHeight,
        }
        const range = rendered ? regionRange(rendered, box) : null
        const invisible = isBoxInvisible(box, viewport.width, viewport.height, range)
        if (invisible) {
          if (!inHiddenRun && hidden !== '') hidden += ' … '
          hidden += item.str + eol
          if (eol && !visible.endsWith('\n')) visible += '\n'
        } else {
          visible += item.str + eol
        }
        inHiddenRun = invisible
      }

      const visibleChars = visible.replace(/\s/g, '').length
      result.textChars += visible.length
      result.pages.push({ page: n, text: visible.trim() })
      if (hidden.trim()) result.hiddenText.push({ page: n, text: hidden.trim() })

      const isScanCandidate = visibleChars < SCAN_TEXT_THRESHOLD
      if (isScanCandidate && rendered && luminanceRange(rendered.pixels) >= 24) {
        if (result.images.length < LIMITS.maxScanPages) {
          result.images.push({
            page: n,
            mimeType: 'image/jpeg',
            data: toBase64Jpeg(rendered.canvas),
          })
        } else {
          result.skippedScanPages.push(n)
        }
      }
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  if (result.textChars === 0 && result.images.length === 0) {
    throw new PdfReadError('W pliku nie znaleziono tekstu ani stron do odczytania.')
  }
  if (result.textChars > LIMITS.maxTextChars) {
    throw new PdfReadError(
      `Dokument jest za długi (${result.textChars.toLocaleString('pl-PL')} znaków, limit ${LIMITS.maxTextChars.toLocaleString('pl-PL')}).`,
    )
  }
  return result
}
