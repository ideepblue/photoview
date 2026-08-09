import { dispatchScannerCompleteForNotification } from './SubscriptionsHook'
import { SCANNER_COMPLETE_EVENT } from '../album/scannerEvents'

test('dispatches completion only for a positive global scanner notification', () => {
  const listener = vi.fn()
  window.addEventListener(SCANNER_COMPLETE_EVENT, listener)

  dispatchScannerCompleteForNotification({
    key: 'global-scanner-progress',
    positive: true,
  })
  dispatchScannerCompleteForNotification({
    key: 'global-scanner-progress',
    positive: false,
  })
  dispatchScannerCompleteForNotification({
    key: 'another-notification',
    positive: true,
  })

  expect(listener).toHaveBeenCalledTimes(1)
  window.removeEventListener(SCANNER_COMPLETE_EVENT, listener)
})
