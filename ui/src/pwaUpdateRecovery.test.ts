import {
  activateWaitingServiceWorker,
  recoverFromPreloadError,
} from './pwaUpdateRecovery'

test('waits for a waiting service worker to take control before continuing', async () => {
  const controller = new EventTarget() as ServiceWorkerContainer
  const postMessage = vi.fn()
  const waiting = { postMessage } as unknown as ServiceWorker
  const registration = { waiting } as ServiceWorkerRegistration

  let completed = false
  const activation = activateWaitingServiceWorker(
    registration,
    controller,
    5000
  ).then(() => {
    completed = true
  })

  expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  await Promise.resolve()
  expect(completed).toBe(false)

  controller.dispatchEvent(new Event('controllerchange'))
  await activation

  expect(completed).toBe(true)
})

test('reloads once when a stale Vite chunk fails on the current URL', () => {
  const reload = vi.fn()
  const storage = new Map<string, string>()
  const session = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  }

  expect(recoverFromPreloadError('/album/1841', session, reload)).toBe(true)
  expect(reload).toHaveBeenCalledTimes(1)

  expect(recoverFromPreloadError('/album/1841', session, reload)).toBe(false)
  expect(reload).toHaveBeenCalledTimes(1)
})
