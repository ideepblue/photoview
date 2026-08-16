const PRELOAD_RECOVERY_KEY = 'photoview-preload-recovery'

type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const activateWaitingServiceWorker = async (
  registration: ServiceWorkerRegistration,
  serviceWorker: ServiceWorkerContainer,
  timeoutMs = 1500
) => {
  const waiting = registration.waiting
  if (waiting === null) return

  await new Promise<void>(resolve => {
    const finish = () => {
      clearTimeout(timeout)
      serviceWorker.removeEventListener('controllerchange', finish)
      resolve()
    }

    serviceWorker.addEventListener('controllerchange', finish, { once: true })
    const timeout = setTimeout(finish, timeoutMs)
    waiting.postMessage({ type: 'SKIP_WAITING' })
  })
}

export const recoverFromPreloadError = (
  currentUrl: string,
  storage: Pick<RecoveryStorage, 'getItem' | 'setItem'>,
  reload: () => void
) => {
  if (storage.getItem(PRELOAD_RECOVERY_KEY) === currentUrl) return false

  storage.setItem(PRELOAD_RECOVERY_KEY, currentUrl)
  reload()
  return true
}

export const clearPreloadRecovery = (storage: RecoveryStorage) => {
  storage.removeItem(PRELOAD_RECOVERY_KEY)
}
