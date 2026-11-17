// Renders public/favicon.svg into every icon and splash the web, Android and iOS builds need.
// Run after changing the logo (a global Playwright is fine):
//   NODE_PATH=$(npm root -g) node scripts/icons.mjs   (playwright or playwright-core)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const { chromium } = (() => { const req = createRequire(import.meta.url); try { return req('playwright') } catch { return req('playwright-core') } })()

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const BG = '#000000'
const PAPER = '#000000'
const drawing = svg.replace(/<path[^>]*\/>/, '') // just the bowl and bracket, no tile

// The drawing at `scale` of the canvas, centred on `bg` (or transparent).
const art = (size, scale, bg, radius = 0) => {
  const inner = Math.round(size * scale)
  return `<style>*{margin:0}</style><div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg};border-radius:${radius}">
    ${drawing.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>`
}
const splash = (w, h) =>
  `<style>*{margin:0}</style><div style="width:${w}px;height:${h}px;display:grid;place-items:center;background:${PAPER}">
    ${svg.replace('<svg ', `<svg width="${Math.round(Math.min(w, h) * 0.28)}" height="${Math.round(Math.min(w, h) * 0.28)}" `)}</div>`

const jobs = [
  // web: maskable icons keep the drawing inside the centre safe zone
  ['public/icon-192.png', 192, 192, art(192, 0.78, BG)],
  ['public/icon-512.png', 512, 512, art(512, 0.78, BG)],
  ['public/apple-touch-icon.png', 180, 180, art(180, 0.82, BG)],
  // iOS: one opaque 1024 square, the system rounds it
  ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024, art(1024, 0.82, BG)],
]
const android = 'android/app/src/main/res'
for (const [dpi, base] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  jobs.push([`${android}/mipmap-${dpi}/ic_launcher.png`, base, base, art(base, 0.84, BG, '18%')])
  jobs.push([`${android}/mipmap-${dpi}/ic_launcher_round.png`, base, base, art(base, 0.78, BG, '50%')])
  // adaptive icon foreground is 108dp with a 66dp safe zone
  const fg = Math.round((base * 108) / 48)
  jobs.push([`${android}/mipmap-${dpi}/ic_launcher_foreground.png`, fg, fg, art(fg, 0.6, 'transparent')])
}
// every splash Capacitor generated, same size, our colours
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
const splashes = [...(existsSync(android) ? walk(android) : []), ...(existsSync('ios/App/App/Assets.xcassets') ? walk('ios/App/App/Assets.xcassets/Splash.imageset') : [])].filter((f) =>
  /splash[^/]*\.png$/.test(f),
)

// CHROME=/path/to/chrome uses an installed browser instead of Playwright's own
const browser = await chromium.launch({ executablePath: process.env.CHROME })
const page = await browser.newPage()
for (const file of splashes) {
  const png = readFileSync(file)
  const w = png.readUInt32BE(16)
  const h = png.readUInt32BE(20)
  jobs.push([file, w, h, splash(w, h)])
}
for (const [path, w, h, html] of jobs) {
  if (path.startsWith('android') && !existsSync(android)) continue
  if (path.startsWith('ios') && !existsSync('ios')) continue
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(html)
  await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } })
}
await browser.close()
console.log(`wrote ${jobs.length} images`)
