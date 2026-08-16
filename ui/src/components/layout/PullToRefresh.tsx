import React, { useRef, useState } from 'react'
import styled from 'styled-components'
import { useTranslation } from 'react-i18next'
import { activateWaitingServiceWorker } from '../../pwaUpdateRecovery'

const PULL_THRESHOLD = 64
const MAX_INDICATOR_OFFSET = 48

type TouchSession = {
  startX: number
  startY: number
  pullDistance: number
}

const Indicator = styled.div<{ offset: number; refreshing: boolean }>`
  position: fixed;
  z-index: 125;
  top: max(8px, env(safe-area-inset-top));
  left: 50%;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  transform: translate3d(-50%, ${({ offset }) => offset - 36}px, 0);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  opacity: ${({ offset, refreshing }) => (offset > 0 || refreshing ? 1 : 0)};
  background: rgba(20, 22, 25, 0.78);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.28);
  pointer-events: none;
  transition: ${({ refreshing }) =>
    refreshing
      ? 'opacity 120ms ease'
      : 'transform 80ms ease, opacity 80ms ease'};
  backdrop-filter: blur(8px);

  &::after {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.42);
    border-top-color: rgba(255, 255, 255, 0.95);
    border-radius: 50%;
    content: '';
    transform: rotate(${({ offset }) => offset * 5}deg);
    animation: ${({ refreshing }) =>
      refreshing ? 'pull-refresh-spin 700ms linear infinite' : 'none'};
  }

  @keyframes pull-refresh-spin {
    to {
      transform: rotate(360deg);
    }
  }
`

const standaloneDisplay = () =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const refreshApplication = async () => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    await registration?.update()
    if (registration?.waiting && navigator.serviceWorker) {
      await activateWaitingServiceWorker(registration, navigator.serviceWorker)
    }
  } catch {
    // A page reload remains useful when a service-worker update check fails.
  }

  window.location.reload()
}

type PullToRefreshProps = {
  children: React.ReactNode
  onRefresh?: () => void | Promise<void>
}

const PullToRefresh = ({ children, onRefresh }: PullToRefreshProps) => {
  const { t } = useTranslation()
  const session = useRef<TouchSession | null>(null)
  const [offset, setOffset] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const reset = () => {
    session.current = null
    setOffset(0)
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const touch = event.touches[0]

    if (
      !standaloneDisplay() ||
      window.scrollY > 0 ||
      event.touches.length !== 1 ||
      touch === undefined ||
      target.closest(
        '[data-disable-pull-to-refresh], input, textarea, select, button, [role="dialog"]'
      )
    ) {
      session.current = null
      return
    }

    session.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      pullDistance: 0,
    }
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const current = session.current
    const touch = event.touches[0]
    if (current === null || touch === undefined || refreshing) return

    const deltaX = touch.clientX - current.startX
    const deltaY = touch.clientY - current.startY
    if (deltaY <= 0 || deltaY <= Math.abs(deltaX) * 1.2) {
      reset()
      return
    }

    current.pullDistance = deltaY
    setOffset(Math.min(MAX_INDICATOR_OFFSET, deltaY * 0.55))
  }

  const handleTouchEnd = () => {
    const shouldRefresh =
      session.current !== null &&
      session.current.pullDistance >= PULL_THRESHOLD &&
      !refreshing

    reset()
    if (!shouldRefresh) return

    setRefreshing(true)
    const refresh = onRefresh ?? refreshApplication
    Promise.resolve(refresh()).catch(() => {
      setRefreshing(false)
    })
  }

  const armed = session.current?.pullDistance
    ? session.current.pullDistance >= PULL_THRESHOLD
    : false

  return (
    <div
      data-testid="pull-to-refresh-surface"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={reset}
    >
      <Indicator
        role="status"
        aria-live="polite"
        aria-label={
          refreshing
            ? t('pwa.pull_to_refresh.refreshing', 'Refreshing')
            : armed
            ? t('pwa.pull_to_refresh.release', 'Release to refresh')
            : t('pwa.pull_to_refresh.pull', 'Pull down to refresh')
        }
        aria-hidden={offset === 0 && !refreshing}
        offset={refreshing ? MAX_INDICATOR_OFFSET : offset}
        refreshing={refreshing}
      />
      {children}
    </div>
  )
}

export default PullToRefresh
