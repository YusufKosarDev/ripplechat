// Renders public/favicon.svg to the raster PWA icons the manifest points at.
// Chrome will not offer "install" unless at least one 192px and one 512px
// bitmap icon actually resolve, and iOS ignores SVG apple-touch-icons — so the
// SVG alone is not enough, however scalable it is.
//
// Run from the frontend/ dir (where @playwright/test is installed):
//   node scripts/render-pwa-icons.mjs
//
// Same headless-Chromium approach as render-logo.mjs, so there is no native
// image dependency (sharp/resvg) to install or keep working on CI.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const publicDir = new URL('../public/', import.meta.url)
const svg = readFileSync(fileURLToPath(new URL('favicon.svg', publicDir)), 'utf8')

// The source art is full-bleed by design (a rounded-square gradient with the
// ripple mark centred well inside), which is exactly what `purpose: maskable`
// wants — a platform mask crops the corners, never the mark.
const icons = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]

const browser = await chromium.launch()
try {
  for (const { file, size } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    // Force the SVG to the target box; the source declares width/height 512.
    await page.setContent(
      `<!doctype html><html><body style="margin:0;padding:0;width:${size}px;height:${size}px">` +
        svg.replace('width="512" height="512"', `width="${size}" height="${size}"`) +
        '</body></html>',
    )
    const el = await page.$('svg')
    await el.screenshot({ path: fileURLToPath(new URL(file, publicDir)) })
    await page.close()
    console.log(`Wrote public/${file} (${size}x${size})`)
  }
} finally {
  await browser.close()
}
