// Encodes the frames from e2e/demo-recording.spec.ts into docs/demo.gif.
//
//   SHOTS=1 npx playwright test demo-recording && node scripts/encode-gif.mjs
//
// Pure JS on purpose: ffmpeg is not a dependency of this project and is not
// installed on every machine that might regenerate the README assets.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// gifenc ships CommonJS, so it has no named ESM exports.
import gifenc from 'gifenc'
import { PNG } from 'pngjs'

const { GIFEncoder, quantize, applyPalette } = gifenc

const FRAME_DIR = fileURLToPath(new URL('../.demo-frames/', import.meta.url))
const OUT = fileURLToPath(new URL('../../docs/demo.gif', import.meta.url))

// Half size keeps the GIF small enough to sit at the top of the README without
// dominating the page weight; the source frames are 1440x900.
const SCALE = 0.5
const FRAME_DELAY_MS = 120
// 256 is the GIF ceiling; the UI is flat colour, so this is comfortably lossless
// enough while keeping the palette small.
const MAX_COLORS = 128

const files = readdirSync(FRAME_DIR)
  .filter((f) => f.endsWith('.png'))
  .sort()
if (files.length === 0) {
  console.error(`No frames in ${FRAME_DIR}. Run: SHOTS=1 npx playwright test demo-recording`)
  process.exit(1)
}

/** Nearest-neighbour downscale. The source is UI, not photography — no ringing to avoid. */
function downscale({ data, width, height }, scale) {
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.round(y / scale))
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.round(x / scale))
      out.set(data.subarray((sy * width + sx) * 4, (sy * width + sx) * 4 + 4), (y * w + x) * 4)
    }
  }
  return { data: out, width: w, height: h }
}

const gif = GIFEncoder()
let dims = null

for (const [i, file] of files.entries()) {
  const png = PNG.sync.read(readFileSync(FRAME_DIR + file))
  const frame = downscale({ data: png.data, width: png.width, height: png.height }, SCALE)
  dims ??= frame
  const palette = quantize(frame.data, MAX_COLORS)
  const index = applyPalette(frame.data, palette)
  gif.writeFrame(index, frame.width, frame.height, { palette, delay: FRAME_DELAY_MS })
  if ((i + 1) % 10 === 0 || i === files.length - 1) {
    process.stdout.write(`\rencoded ${i + 1}/${files.length} frames`)
  }
}
gif.finish()

writeFileSync(OUT, Buffer.from(gif.bytes()))
const kb = (statSync(OUT).size / 1024).toFixed(0)
console.log(
  `\nWrote docs/demo.gif — ${files.length} frames, ${dims.width}x${dims.height}, ${kb} KB`,
)
