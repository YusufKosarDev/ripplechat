// Renders docs/logo.svg to docs/logo.png (transparent, 2x) via headless Chromium.
// Run from the frontend/ dir (where @playwright/test is installed):
//   node scripts/render-logo.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svgPath = fileURLToPath(new URL('../../docs/logo.svg', import.meta.url))
const pngPath = fileURLToPath(new URL('../../docs/logo.png', import.meta.url))
const svg = readFileSync(svgPath, 'utf8')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 })
await page.setContent(`<!doctype html><html><body style="margin:0;padding:0">${svg}</body></html>`)
const el = await page.$('svg')
await el.screenshot({ path: pngPath, omitBackground: true })
await browser.close()
console.log('Wrote', pngPath)
