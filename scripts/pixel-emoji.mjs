// Turns every Fluent Emoji the app uses into a 16×16 pixel-art sprite (src/pixels.json, PNG data URLs).
// Each picture is drawn small in headless Chrome or Edge, then its edges are made hard: no half-transparent
// pixels, colours pushed a little brighter so they read on the black ground.
// Run after adding an emoji to the `fluent` list in src/icons.tsx:
//   node scripts/pixel-emoji.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const GRID = 16
const icons = createRequire(import.meta.url)('@iconify-json/fluent-emoji-flat/icons.json')
const source = readFileSync(new URL('../src/icons.tsx', import.meta.url), 'utf8')
const start = source.indexOf('const fluent')
const list = source.slice(start, source.indexOf('\n}', start))
const wanted = [...list.matchAll(/'([^']+)': '([a-z0-9-]+)'/g)].map(([, e, name]) => [e, name])

const svgs = wanted.map(([e, name]) => {
  const icon = icons.icons[name]
  if (!icon) throw new Error(`no Fluent icon ${name}`)
  const w = icon.width ?? icons.width
  const h = icon.height ?? icons.height
  return [e, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${icon.body}</svg>`]
})

const html = `<!doctype html><pre id="out"></pre><script>
const G = ${GRID}, list = ${JSON.stringify(svgs)}
const out = {}
Promise.all(list.map(async ([e, svg]) => {
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const c = document.createElement('canvas')
  c.width = c.height = G
  const x = c.getContext('2d', { willReadFrequently: true })
  x.imageSmoothingQuality = 'high'
  x.drawImage(img, 0, 0, G, G)
  const d = x.getImageData(0, 0, G, G)
  const p = d.data
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 110) { p[i] = p[i + 1] = p[i + 2] = p[i + 3] = 0; continue }
    // a touch more saturated, colours snapped to a coarse ramp, hard edges
    let r = p[i], g = p[i + 1], b = p[i + 2]
    const m = (r + g + b) / 3
    r = m + (r - m) * 1.25; g = m + (g - m) * 1.25; b = m + (b - m) * 1.25
    const q = (v) => Math.max(0, Math.min(255, Math.round(v / 24) * 24))
    p[i] = q(r); p[i + 1] = q(g); p[i + 2] = q(b); p[i + 3] = 255
  }
  x.putImageData(d, 0, 0)
  out[e] = c.toDataURL('image/png')
})).then(() => { document.getElementById('out').textContent = JSON.stringify(out) })
</script>`

const file = join(tmpdir(), `matcha-pixels-${process.pid}.html`)
writeFileSync(file, html)
const browsers = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
const chrome = process.env.CHROME ?? browsers.find(existsSync)
if (!chrome) throw new Error('no Chrome found: set CHROME=/path/to/chrome')
const dom = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--virtual-time-budget=10000', '--dump-dom', `file:///${file.replace(/\\/g, '/')}`], { encoding: 'utf8', maxBuffer: 1 << 26 })
rmSync(file)
const json = dom.match(/<pre id="out">(.*)<\/pre>/s)?.[1]
if (!json) throw new Error('Chrome returned no sprites')
const sprites = JSON.parse(json.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
if (Object.keys(sprites).length !== wanted.length) throw new Error(`got ${Object.keys(sprites).length} of ${wanted.length} sprites`)
writeFileSync(new URL('../src/pixels.json', import.meta.url), JSON.stringify(sprites) + '\n')
console.log(`wrote ${wanted.length} sprites`)
