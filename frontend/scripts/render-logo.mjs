// Renders docs/logo.svg to docs/logo.png via headless Chromium.
//
// 320px, not 1024: the README displays it at width=110, so this is already 3x
// for high-DPI screens. The previous 512@2x produced a 330 KB asset for a
// thumbnail, which is most of what the repo weighed outside the screenshots.
// Run from the frontend/ dir (where @playwright/test is installed):
//   node scripts/render-logo.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svgPath = fileURLToPath(new URL('../../docs/logo.svg', import.meta.url))
const pngPath = fileURLToPath(new URL('../../docs/logo.png', import.meta.url))
const svg = readFileSync(svgPath, 'utf8')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 320, height: 320 }, deviceScaleFactor: 1 })
await page.setContent(`<!doctype html><html><body style="margin:0;padding:0">${svg.replace('width="512" height="512"', 'width="320" height="320"')}</body></html>`)
const el = await page.$('svg')
await el.screenshot({ path: pngPath, omitBackground: true })
await browser.close()
console.log('Wrote', pngPath)
