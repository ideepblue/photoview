import React, {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import styled from 'styled-components'
import PresentMedia, { PresentMediaFields } from './PresentMedia'
import {
  completionOffset,
  getLayerTranslations,
  lockSwipeAxis,
  navigationForOffset,
  shouldCommitSwipe,
  SwipeAxis,
  SwipeNavigation,
  SwipePoint,
} from './swipeMotion'

const COMMIT_DURATION_MS = 220
const REBOUND_DURATION_MS = 180
const SETTLE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DEFAULT_ZOOM_SCALE = 2.5
const ZOOM_PRESETS = [1.5, 2.5, 4]
const MIN_ZOOM_SCALE = ZOOM_PRESETS[0]
const MAX_ZOOM_SCALE = ZOOM_PRESETS[ZOOM_PRESETS.length - 1]
const DOUBLE_TAP_DELAY_MS = 300
const DOUBLE_TAP_DISTANCE_PX = 32
const ZOOM_RAIL_HIDE_DELAY_MS = 2000

const SwipeTrack = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none;
  user-select: none;
`

const MediaLayer = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: black;
  will-change: transform;
`

const ZoomedMedia = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  will-change: transform;
`

const ZoomScaleRail = styled.div`
  position: absolute;
  z-index: 3;
  top: 50%;
  right: max(16px, env(safe-area-inset-right));
  display: grid;
  width: 36px;
  height: 160px;
  padding: 12px 0;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 18px;
  background: rgba(20, 20, 24, 0.64);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  transform: translateY(-50%);
  touch-action: none;
  backdrop-filter: blur(12px);
  transition: opacity 180ms ease, transform 180ms ease;

  &.hide {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-50%) scale(0.88);
  }

  &::before {
    width: 2px;
    height: 100%;
    content: '';
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.38);
  }
`

const ZoomScaleValue = styled.span`
  position: absolute;
  right: 44px;
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(20, 20, 24, 0.76);
  color: white;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
`

type MotionState = {
  axis: SwipeAxis | null
  offset: number
  target: SwipeNavigation | null
  duration: number
  settling: boolean
}

type PointerSession = {
  id: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  startTime: number
  moved: boolean
}

type ZoomState = {
  origin: SwipePoint
  pan: SwipePoint
  scale: number
}

type Tap = {
  x: number
  y: number
  time: number
}

type ZoomRailPointer = {
  id: number
  startY: number
  moved: boolean
}

type PresentSwipeTrackProps = {
  currentMedia: PresentMediaFields
  nextMedia: PresentMediaFields | null
  previousMedia: PresentMediaFields | null
  onNavigate(navigation: SwipeNavigation): void
  onTap?(): void
  imageLoaded?(): void
  onViewingActive?(active: boolean): void
  onZoomChange?(zoomed: boolean): void
  loadHighRes?: boolean
}

const idleMotion = (): MotionState => ({
  axis: null,
  offset: 0,
  target: null,
  duration: 0,
  settling: false,
})

const reduceMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const transformValue = ({ x, y }: SwipePoint) =>
  `translate3d(${x}px, ${y}px, 0)`

const PresentSwipeTrack = ({
  currentMedia,
  nextMedia,
  previousMedia,
  onNavigate,
  onTap,
  imageLoaded,
  onViewingActive,
  onZoomChange,
  loadHighRes = true,
}: PresentSwipeTrackProps) => {
  const [motion, setMotion] = useState<MotionState>(idleMotion)
  const motionRef = useRef<MotionState>(motion)
  const pointerRef = useRef<PointerSession | null>(null)
  const viewportRef = useRef({ width: 0, height: 0 })
  const settleTimerRef = useRef<number | null>(null)
  const [zoom, setZoom] = useState<ZoomState | null>(null)
  const zoomRef = useRef<ZoomState | null>(null)
  const lastTapRef = useRef<Tap | null>(null)
  const [showZoomRail, setShowZoomRail] = useState(false)
  const zoomRailPointerRef = useRef<ZoomRailPointer | null>(null)
  const zoomRailTimerRef = useRef<number | null>(null)

  const updateMotion = useCallback((nextMotion: MotionState) => {
    motionRef.current = nextMotion
    setMotion(nextMotion)
  }, [])

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }, [])

  const resetMotion = useCallback(() => {
    clearSettleTimer()
    pointerRef.current = null
    updateMotion(idleMotion())
  }, [clearSettleTimer, updateMotion])

  const clearZoomRailTimer = useCallback(() => {
    if (zoomRailTimerRef.current !== null) {
      window.clearTimeout(zoomRailTimerRef.current)
      zoomRailTimerRef.current = null
    }
  }, [])

  const revealZoomRail = useCallback(() => {
    clearZoomRailTimer()
    setShowZoomRail(true)
    zoomRailTimerRef.current = window.setTimeout(() => {
      zoomRailTimerRef.current = null
      setShowZoomRail(false)
    }, ZOOM_RAIL_HIDE_DELAY_MS)
  }, [clearZoomRailTimer])

  const resetZoom = useCallback(() => {
    clearZoomRailTimer()
    zoomRef.current = null
    lastTapRef.current = null
    zoomRailPointerRef.current = null
    setShowZoomRail(false)
    setZoom(null)
    onZoomChange?.(false)
  }, [clearZoomRailTimer, onZoomChange])

  const enterZoom = useCallback(
    (origin: SwipePoint) => {
      const nextZoom = {
        origin,
        pan: { x: 0, y: 0 },
        scale: DEFAULT_ZOOM_SCALE,
      }
      zoomRef.current = nextZoom
      lastTapRef.current = null
      setZoom(nextZoom)
      onZoomChange?.(true)
      revealZoomRail()
    },
    [onZoomChange, revealZoomRail]
  )

  const scheduleSettle = useCallback(
    (duration: number, navigation: SwipeNavigation | null) => {
      clearSettleTimer()

      const complete = () => {
        settleTimerRef.current = null
        if (navigation !== null) onNavigate(navigation)
        pointerRef.current = null
        updateMotion(idleMotion())
      }

      if (duration === 0) {
        complete()
      } else {
        settleTimerRef.current = window.setTimeout(complete, duration)
      }
    },
    [clearSettleTimer, onNavigate, updateMotion]
  )

  const rebound = useCallback(() => {
    const activeMotion = motionRef.current
    pointerRef.current = null

    if (activeMotion.axis === null || activeMotion.target === null) {
      resetMotion()
      return
    }

    const duration = reduceMotion() ? 0 : REBOUND_DURATION_MS
    updateMotion({
      ...activeMotion,
      offset: 0,
      duration,
      settling: true,
    })
    scheduleSettle(duration, null)
  }, [resetMotion, scheduleSettle, updateMotion])

  useEffect(() => {
    const handleWindowBlur = () => {
      if (pointerRef.current !== null) rebound()
    }

    window.addEventListener('blur', handleWindowBlur)
    return () => window.removeEventListener('blur', handleWindowBlur)
  }, [rebound])

  useEffect(() => {
    resetMotion()
    resetZoom()
  }, [currentMedia.id, resetMotion, resetZoom])

  useEffect(
    () => () => {
      clearSettleTimer()
      clearZoomRailTimer()
      pointerRef.current = null
      zoomRef.current = null
      zoomRailPointerRef.current = null
    },
    [clearSettleTimer, clearZoomRailTimer]
  )

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.isPrimary === false ||
      event.button > 0 ||
      pointerRef.current !== null ||
      motionRef.current.settling
    ) {
      return
    }

    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      startTime: event.timeStamp,
      moved: false,
    }
    viewportRef.current = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current
    if (pointer === null || pointer.id !== event.pointerId) return

    const activeZoom = zoomRef.current
    if (activeZoom !== null) {
      const delta = {
        x: event.clientX - pointer.currentX,
        y: event.clientY - pointer.currentY,
      }
      const maxX = Math.max(
        0,
        (viewportRef.current.width * (activeZoom.scale - 1)) / 2
      )
      const maxY = Math.max(
        0,
        (viewportRef.current.height * (activeZoom.scale - 1)) / 2
      )
      const nextZoom = {
        ...activeZoom,
        pan: {
          x: Math.max(-maxX, Math.min(maxX, activeZoom.pan.x + delta.x)),
          y: Math.max(-maxY, Math.min(maxY, activeZoom.pan.y + delta.y)),
        },
      }
      zoomRef.current = nextZoom
      setZoom(nextZoom)
      pointerRef.current = {
        ...pointer,
        currentX: event.clientX,
        currentY: event.clientY,
        moved: true,
      }
      return
    }

    const delta = {
      x: event.clientX - pointer.startX,
      y: event.clientY - pointer.startY,
    }

    const axis = motionRef.current.axis ?? lockSwipeAxis(delta)
    if (axis === null) return

    const offset = axis === 'x' ? delta.x : delta.y
    const requestedTarget = navigationForOffset(offset)
    const targetAvailable =
      (requestedTarget === 'nextImage' && nextMedia !== null) ||
      (requestedTarget === 'previousImage' && previousMedia !== null)

    updateMotion({
      axis,
      offset: targetAvailable ? offset : 0,
      target: targetAvailable ? requestedTarget : null,
      duration: 0,
      settling: false,
    })
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current
    if (pointer === null || pointer.id !== event.pointerId) return

    event.currentTarget.releasePointerCapture?.(event.pointerId)
    pointerRef.current = null

    const tapDistance = pointer.moved
      ? DOUBLE_TAP_DISTANCE_PX
      : Math.hypot(
          event.clientX - pointer.startX,
          event.clientY - pointer.startY
        )
    const tap = {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
    }
    const previousTap = lastTapRef.current
    const isDoubleTap =
      tapDistance < DOUBLE_TAP_DISTANCE_PX &&
      previousTap !== null &&
      tap.time - previousTap.time <= DOUBLE_TAP_DELAY_MS &&
      Math.hypot(tap.x - previousTap.x, tap.y - previousTap.y) <=
        DOUBLE_TAP_DISTANCE_PX

    if (zoomRef.current !== null) {
      if (isDoubleTap) resetZoom()
      else if (tapDistance < DOUBLE_TAP_DISTANCE_PX) {
        lastTapRef.current = tap
        revealZoomRail()
        onTap?.()
      }
      return
    }

    const activeMotion = motionRef.current
    if (activeMotion.axis === null || activeMotion.target === null) {
      if (isDoubleTap) enterZoom({ x: tap.x, y: tap.y })
      else {
        lastTapRef.current = tap
        onTap?.()
      }
      resetMotion()
      return
    }

    const viewportSize =
      activeMotion.axis === 'x'
        ? viewportRef.current.width
        : viewportRef.current.height
    const elapsed = Math.max(event.timeStamp - pointer.startTime, 1)
    const velocity = activeMotion.offset / elapsed
    const commit = shouldCommitSwipe(
      activeMotion.offset,
      viewportSize,
      velocity
    )
    const duration = reduceMotion()
      ? 0
      : commit
      ? COMMIT_DURATION_MS
      : REBOUND_DURATION_MS

    updateMotion({
      ...activeMotion,
      offset: commit ? completionOffset(activeMotion.target, viewportSize) : 0,
      duration,
      settling: true,
    })
    scheduleSettle(duration, commit ? activeMotion.target : null)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerRef.current?.id !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    rebound()
  }

  const setZoomScale = (scale: number) => {
    const activeZoom = zoomRef.current
    if (activeZoom === null) return

    const nextZoom = { ...activeZoom, scale }
    zoomRef.current = nextZoom
    setZoom(nextZoom)
  }

  const cycleZoomScale = () => {
    const activeZoom = zoomRef.current
    if (activeZoom === null) return

    const currentPreset = ZOOM_PRESETS.indexOf(activeZoom.scale)
    const nextScale =
      ZOOM_PRESETS[(currentPreset + 1) % ZOOM_PRESETS.length] ??
      DEFAULT_ZOOM_SCALE
    setZoomScale(nextScale)
  }

  const setZoomScaleForRailPointer = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const range = Math.max(bounds.height, 1)
    const progress = Math.max(
      0,
      Math.min(1, (bounds.top + bounds.height - event.clientY) / range)
    )
    const scale =
      Math.round(
        (MIN_ZOOM_SCALE + progress * (MAX_ZOOM_SCALE - MIN_ZOOM_SCALE)) * 10
      ) / 10
    setZoomScale(scale)
  }

  const targetMedia =
    motion.target === 'nextImage'
      ? nextMedia
      : motion.target === 'previousImage'
      ? previousMedia
      : null
  const viewportSize =
    motion.axis === 'x' ? viewportRef.current.width : viewportRef.current.height
  const translations =
    motion.axis !== null && motion.target !== null
      ? getLayerTranslations(
          motion.axis,
          motion.offset,
          viewportSize,
          motion.target
        )
      : {
          current: { x: 0, y: 0 },
          target: { x: 0, y: 0 },
        }
  const transition =
    motion.duration > 0
      ? `transform ${motion.duration}ms ${SETTLE_EASING}`
      : 'none'

  return (
    <SwipeTrack
      data-testid="present-swipe-track"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {targetMedia !== null && (
        <MediaLayer
          data-testid="present-swipe-target"
          style={{
            transform: transformValue(translations.target),
            transition,
          }}
        >
          <PresentMedia media={targetMedia} loadHighRes={loadHighRes} />
        </MediaLayer>
      )}
      <MediaLayer
        data-testid="present-swipe-current"
        style={{
          transform: transformValue(translations.current),
          transition,
        }}
      >
        <ZoomedMedia
          data-testid={zoom !== null ? 'present-zoomed-media' : undefined}
          style={
            zoom !== null
              ? {
                  transform: `translate3d(${zoom.pan.x}px, ${zoom.pan.y}px, 0) scale(${zoom.scale})`,
                  transformOrigin: `${zoom.origin.x}px ${zoom.origin.y}px`,
                }
              : undefined
          }
        >
          <PresentMedia
            media={currentMedia}
            imageLoaded={imageLoaded}
            onViewingActive={onViewingActive}
            loadHighRes={loadHighRes}
          />
        </ZoomedMedia>
      </MediaLayer>
      {zoom !== null && (
        <ZoomScaleRail
          data-testid="present-zoom-scale-rail"
          className={showZoomRail ? undefined : 'hide'}
          onPointerDown={event => {
            event.stopPropagation()
            event.currentTarget.setPointerCapture?.(event.pointerId)
            zoomRailPointerRef.current = {
              id: event.pointerId,
              startY: event.clientY,
              moved: false,
            }
            revealZoomRail()
          }}
          onPointerMove={event => {
            const pointer = zoomRailPointerRef.current
            if (pointer === null || pointer.id !== event.pointerId) return

            event.stopPropagation()
            zoomRailPointerRef.current = {
              ...pointer,
              moved:
                pointer.moved ||
                Math.abs(event.clientY - pointer.startY) >
                  DOUBLE_TAP_DISTANCE_PX,
            }
            setZoomScaleForRailPointer(event)
            revealZoomRail()
          }}
          onPointerUp={event => {
            const pointer = zoomRailPointerRef.current
            if (pointer === null || pointer.id !== event.pointerId) return

            event.stopPropagation()
            event.currentTarget.releasePointerCapture?.(event.pointerId)
            zoomRailPointerRef.current = null
            if (pointer.moved) setZoomScaleForRailPointer(event)
            else cycleZoomScale()
            revealZoomRail()
          }}
          onPointerCancel={event => {
            if (zoomRailPointerRef.current?.id !== event.pointerId) return

            event.stopPropagation()
            event.currentTarget.releasePointerCapture?.(event.pointerId)
            zoomRailPointerRef.current = null
          }}
        >
          <ZoomScaleValue>{`${zoom.scale}×`}</ZoomScaleValue>
        </ZoomScaleRail>
      )}
    </SwipeTrack>
  )
}

export default PresentSwipeTrack
