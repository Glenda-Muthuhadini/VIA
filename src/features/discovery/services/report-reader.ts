import { parseReportResults, type ReportSubject } from './report-results'
import type { Worker } from 'tesseract.js'

function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException('Cancelled', 'AbortError'))
    if (signal.aborted) { cancel(); return }
    signal.addEventListener('abort', cancel, { once: true })
    void promise.then(value => { signal.removeEventListener('abort', cancel); resolve(value) }, error => { signal.removeEventListener('abort', cancel); reject(error) })
  })
}

export async function extractReport(file: File, subjects: ReportSubject[], signal: AbortSignal, progress: (message: string) => void, includeText = false, maxPdfPages = 5) {
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 10485760) throw new Error('Choose a PDF, JPG or PNG up to 10 MB.')
  let worker: Worker | undefined
  const abort = () => { void worker?.terminate() }
  const check = () => { if (signal.aborted) throw new DOMException('Cancelled', 'AbortError') }
  signal.addEventListener('abort', abort, { once: true })
  async function recognise(image: HTMLCanvasElement) {
    check()
    if (!worker) {
      progress('Preparing report reader…')
      const { createWorker } = await import('tesseract.js')
      check()
      const base = new URL(`${import.meta.env.BASE_URL}vendor/report-reader/`, location.href).href
      const starting = createWorker('eng', 1, { workerPath: `${base}worker.min.js`, corePath: base, langPath: base, cacheMethod: 'none', logger: message => {
        if (!signal.aborted && message.status === 'recognizing text') progress(`Reading subjects and marks… ${Math.round(message.progress * 100)}%`)
      } }).then(instance => {
        if (signal.aborted) { void instance.terminate(); throw new DOMException('Cancelled', 'AbortError') }
        worker = instance
        return instance
      })
      worker = await cancellable(starting, signal)
      check()
    }
    const { data } = await cancellable(worker.recognize(image), signal)
    check()
    return data.text
  }
  function canvasFor(width: number, height: number) {
    const scale = Math.min(1, 2200 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale))
    return canvas
  }
  try {
    let text = ''
    if (file.type === 'application/pdf') {
      progress('Opening report…')
      const pdfjs = await import('pdfjs-dist')
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      check()
      const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
      const cancelPdf = () => { void task.destroy() }
      signal.addEventListener('abort', cancelPdf, { once: true })
      try {
        const pdf = await task.promise
        if (pdf.numPages > maxPdfPages) throw new Error('Choose a report of up to 5 pages, or upload a photo of the results page.')
        for (let number = 1; number <= pdf.numPages; number++) {
          check(); progress(`Reading page ${number} of ${pdf.numPages}…`)
          const page = await pdf.getPage(number)
          const content = await page.getTextContent()
          const lines = new Map<number, { x: number; text: string }[]>()
          for (const item of content.items) {
            if (!('str' in item)) continue
            const y = Math.round(item.transform[5] / 3) * 3
            const line = lines.get(y) ?? []; line.push({ x: item.transform[4], text: item.str }); lines.set(y, line)
          }
          let pageText = [...lines].sort((a, b) => b[0] - a[0]).map(([, line]) => line.sort((a, b) => a.x - b.x).map(item => item.text).join(' ')).join('\n')
          // Scanned PDFs have no useful text layer: render the page and run OCR.
          if (!parseReportResults(pageText, subjects).results.length) {
            const natural = page.getViewport({ scale: 2 })
            const canvas = canvasFor(natural.width, natural.height)
            const viewport = page.getViewport({ scale: 2 * canvas.width / natural.width })
            try { await page.render({ canvas, viewport }).promise; pageText = await recognise(canvas) }
            finally { canvas.width = 0; canvas.height = 0 }
          }
          text += `${pageText}\n`; page.cleanup()
        }
      } finally { signal.removeEventListener('abort', cancelPdf); await task.destroy() }
    } else {
      progress('Opening photo…')
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      const canvas = canvasFor(bitmap.width, bitmap.height)
      try {
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Your browser could not open this photo.')
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        text = await recognise(canvas)
      } finally { bitmap.close(); canvas.width = 0; canvas.height = 0 }
    }
    check()
    const result = parseReportResults(text, subjects)
    if (!result.results.length) throw new Error('No subjects could be read. Try a clearer photo or enter your results manually.')
    return { ...result, ...(includeText ? { text } : {}) }
  } catch (reason) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    const message = reason instanceof Error ? reason.message : ''
    if (/password/i.test(message)) throw new Error('Use an unlocked PDF, or upload a photo of your results.')
    if (/^(Choose a report|No subjects|Your browser)/.test(message)) throw reason
    throw new Error('We could not read this file. Try a clearer photo or enter your results manually.')
  } finally { signal.removeEventListener('abort', abort); await worker?.terminate() }
}
