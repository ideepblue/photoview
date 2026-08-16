import { readFile, stat } from 'node:fs/promises'

const serviceWorkerPath = new URL('../dist/service-worker.js', import.meta.url)
const manifestPath = new URL('../dist/manifest.json', import.meta.url)

const serviceWorker = await readFile(serviceWorkerPath, 'utf8')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const serviceWorkerStats = await stat(serviceWorkerPath)

if (
  serviceWorkerStats.size < 500 ||
  !serviceWorker.includes('photoview-app-shell-') ||
  !serviceWorker.includes('SKIP_WAITING') ||
  !serviceWorker.includes("url.pathname.startsWith('/photo/')")
) {
  throw new Error(
    'The production build is missing the generated PWA service worker'
  )
}

if (manifest.display !== 'standalone' || manifest.start_url !== '/') {
  throw new Error(
    'The production manifest is not configured as a standalone app'
  )
}

console.log('PWA build artifacts verified')
