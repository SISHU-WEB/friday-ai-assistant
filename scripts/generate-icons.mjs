// One-off generator for iOS/PWA PNG icons from the SVG master (C-3).
// Usage: node scripts/generate-icons.mjs
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const svg = await readFile(fileURLToPath(new URL('../public/icon-512.svg', import.meta.url)))

for (const size of [180, 192, 512]) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url)))
  console.log(`generated public/icon-${size}.png`)
}
