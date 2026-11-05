export class PdfReadError extends Error {
  readonly userMessage: string
  constructor(userMessage: string, cause?: unknown) {
    super(userMessage, { cause })
    this.name = 'PdfReadError'
    this.userMessage = userMessage
  }
}
