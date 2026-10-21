// Host OCR runtime/model files with VIA; reports never go to an OCR service.
import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
const require = createRequire(import.meta.url)
const root = path.resolve('public/vendor/report-reader')
await mkdir(root, { recursive: true })
const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ...['', '-simd', '-relaxedsimd'].map(variant => [`tesseract.js-core/tesseract-core${variant}-lstm.wasm.js`, `tesseract-core${variant}-lstm.wasm.js`]),
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]
for (const [source, destination] of files) await copyFile(require.resolve(source), path.join(root, destination))
console.log('Prepared local report-reader worker, OCR engines and English model.')
