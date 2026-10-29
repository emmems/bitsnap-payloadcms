import { cp, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const srcDir = join(root, 'src')
const distDir = join(root, 'dist')

const ASSET_EXTENSIONS = new Set(['.css', '.scss', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.woff', '.woff2'])

async function collectAssets(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const assets = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      assets.push(...(await collectAssets(fullPath)))
      continue
    }

    const extension = entry.name.slice(entry.name.lastIndexOf('.'))
    if (ASSET_EXTENSIONS.has(extension)) {
      assets.push(fullPath)
    }
  }

  return assets
}

const assets = await collectAssets(srcDir)

for (const asset of assets) {
  const target = join(distDir, relative(srcDir, asset))
  await cp(asset, target)
}

console.log(`copied ${assets.length} asset(s) to dist`)
