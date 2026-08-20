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
const ZOOM_SCALE = 2.5
const DOUBLE_TAP_DELAY_MS = 300
const DOUBLE_TAP_DISTANCE_PX = 32

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
}

type Tap = {
  x: number
  y: number
  time: number
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
}: PresentSwipeTrackProps) => {
  const [motion, setMotion] = useState<MotionState>(idleMotion)
  const motionRef = useRef<MotionState>(motion)
  const pointerRef = useRef<PointerSession | null>(null)
  const viewportRef = useRef({ width: 0, height: 0 })
  const settleTimerRef = useRef<number | null>(null)
  const [zoom, setZoom] = useState<ZoomState | null>(null)
  const zoomRef = useRef<ZoomState | null>(null)
  const lastTapRef = useRef<Tap | null>(null)

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

  const resetZoom = useCallback(() => {
    zoomRef.current = null
    lastTapRef.current = null
    setZoom(null)
    onZoomChange?.(false)
  }, [onZoomChange])

  const enterZoom = useCallback(
    (origin: SwipePoint) => {
      const nextZoom = { origin, pan: { x: 0, y: 0 } }
      zoomRef.current = nextZoom
      lastTapRef.current = null
      setZoom(nextZoom)
      onZoomChange?.(true)
    },
    [onZoomChange]
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
      pointerRef.current = null
      zoomRef.current = null
    },
    [clearSettleTimer]
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
        (viewportRef.current.width * (ZOOM_SCALE - 1)) / 2
      )
      const maxY = Math.max(
        0,
        (viewportRef.current.height * (ZOOM_SCALE - 1)) / 2
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
      else if (tapDistance < DOUBLE_TAP_DISTANCE_PX) lastTapRef.current = tap
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
          <PresentMedia media={targetMedia} />
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
                  transform: `translate3d(${zoom.pan.x}px, ${zoom.pan.y}px, 0) scale(${ZOOM_SCALE})`,
                  transformOrigin: `${zoom.origin.x}px ${zoom.origin.y}px`,
                }
              : undefined
          }
        >
          <PresentMedia
            media={currentMedia}
            imageLoaded={imageLoaded}
            onViewingActive={onViewingActive}
          />
        </ZoomedMedia>
      </MediaLayer>
    </SwipeTrack>
  )
}

export default PresentSwipeTrack
