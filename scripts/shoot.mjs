// Screenshot harness: enters the museum, travels to each chamber
// center, lets the scene settle, and captures a frame of each.
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const OUT = new URL('../shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text())
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.screenshot({ path: OUT + '00-entry.png' })

// enter
await page.click('.e-enter')
await page.waitForTimeout(3000)

const chambers = ['foam', 'lattice', 'membrane', 'bloom', 'vessel', 'spire', 'terra', 'sphere', 'star', 'web']
for (let i = 0; i < 10; i++) {
  if (only && !only.includes(i)) continue
  await page.evaluate((idx) => {
    window.__setProgress?.((idx + 0.5) / 10)
  }, i)
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}${String(i + 1).padStart(2, '0')}-${chambers[i]}.png` })
  console.log('shot', chambers[i])
}

// the seam
await page.evaluate(() => window.__setProgress?.(0.999))
await page.waitForTimeout(1500)
await page.screenshot({ path: OUT + '11-seam.png' })

await browser.close()
console.log('done →', OUT)
