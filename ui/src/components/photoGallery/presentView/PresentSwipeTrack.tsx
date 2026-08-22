import React, {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { MediaType } from '../../../__generated__/globalTypes'
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
import {
  clampPan,
  clampPointToRect,
  getContainedPhotoRect,
  getFillScale,
  getZoomRange,
  initialPanForFocus,
  ZoomRange,
  ZoomRect,
  ZoomSize,
} from './zoomGeometry'

const COMMIT_DURATION_MS = 220
const REBOUND_DURATION_MS = 180
const SETTLE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DEFAULT_ZOOM_SCALE = 2.5
const ZOOM_PRESETS = [1.5, 2.5, 4] as const
const FILL_SNAP_DISTANCE = 0.05
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
  bottom: max(96px, calc(env(safe-area-inset-bottom) + 76px));
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
  touch-action: none;
  backdrop-filter: blur(12px);
  transition: opacity 180ms ease, transform 180ms ease;

  &.hide {
    opacity: 0;
    pointer-events: none;
    transform: scale(0.88);
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
  transform: translateY(-50%);
  transition: top 90ms linear;
`

const ZoomScaleMarker = styled.span`
  position: absolute;
  left: 50%;
  width: 8px;
  height: 8px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  background: rgba(91, 224, 178, 0.88);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.75);
  transform: translate(-50%, -50%);
  transition: top 90ms linear;
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
  mode: 'fill' | 'manual'
  focus: SwipePoint
  fillScale: number | null
  range: ZoomRange
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

type ZoomChoice =
  | { kind: 'fill' }
  | { kind: 'scale'; value: typeof ZOOM_PRESETS[number] }

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

const readViewportSize = (): ZoomSize => ({
  width: window.innerWidth,
  height: window.innerHeight,
})

const getPhotoSize = (media: PresentMediaFields): ZoomSize | null =>
  media.type === MediaType.Photo && media.thumbnail !== null
    ? {
        width: media.thumbnail.width,
        height: media.thumbnail.height,
      }
    : null

const normalizedFocusForPoint = (point: SwipePoint, rect: ZoomRect) => ({
  x: (point.x - rect.x) / rect.width,
  y: (point.y - rect.y) / rect.height,
})

const focusPointForNormalizedFocus = (
  focus: SwipePoint,
  rect: ZoomRect
): SwipePoint => ({
  x: rect.x + focus.x * rect.width,
  y: rect.y + focus.y * rect.height,
})

const transformValue = ({ x, y }: SwipePoint) =>
  `translate3d(${x}px, ${y}px, 0)`

const zoomScaleProgress = (scale: number, range: ZoomRange) =>
  Math.max(0, Math.min(1, (scale - range.min) / (range.max - range.min)))

const clampScale = (scale: number, range: ZoomRange) =>
  Math.max(range.min, Math.min(range.max, scale))

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
  const { t } = useTranslation()
  const [motion, setMotion] = useState<MotionState>(idleMotion)
  const motionRef = useRef<MotionState>(motion)
  const pointerRef = useRef<PointerSession | null>(null)
  const initialViewportSize = useMemo(readViewportSize, [])
  const [viewportSize, setViewportSize] = useState(initialViewportSize)
  const viewportRef = useRef(initialViewportSize)
  const settleTimerRef = useRef<number | null>(null)
  const [zoom, setZoom] = useState<ZoomState | null>(null)
  const zoomRef = useRef<ZoomState | null>(null)
  const lastTapRef = useRef<Tap | null>(null)
  const [showZoomRail, setShowZoomRail] = useState(false)
  const zoomRailPointerRef = useRef<ZoomRailPointer | null>(null)
  const zoomRailTimerRef = useRef<number | null>(null)
  const photoSize = useMemo(() => getPhotoSize(currentMedia), [currentMedia])
  const photoRect = useMemo(
    () =>
      photoSize === null
        ? null
        : getContainedPhotoRect(viewportSize, photoSize),
    [photoSize, viewportSize]
  )
  const fillScale = useMemo(
    () => (photoSize === null ? null : getFillScale(viewportSize, photoSize)),
    [photoSize, viewportSize]
  )
  const zoomRange = useMemo(() => getZoomRange(fillScale), [fillScale])

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
      const focusOrigin =
        photoRect === null ? origin : clampPointToRect(origin, photoRect)
      const focus =
        photoRect === null
          ? { x: 0.5, y: 0.5 }
          : normalizedFocusForPoint(focusOrigin, photoRect)
      const nextScale = fillScale ?? DEFAULT_ZOOM_SCALE
      const nextZoom = {
        origin: focusOrigin,
        pan:
          photoRect === null
            ? { x: 0, y: 0 }
            : initialPanForFocus({
                viewport: viewportSize,
                photoRect,
                scale: nextScale,
                origin: focusOrigin,
              }),
        scale: nextScale,
        mode: fillScale === null ? 'manual' : 'fill',
        focus,
        fillScale,
        range: zoomRange,
      }
      zoomRef.current = nextZoom
      lastTapRef.current = null
      setZoom(nextZoom)
      onZoomChange?.(true)
      revealZoomRail()
    },
    [
      fillScale,
      onZoomChange,
      photoRect,
      revealZoomRail,
      viewportSize,
      zoomRange,
    ]
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

  useEffect(() => {
    const handleResize = () => {
      const nextViewport = readViewportSize()
      const previousViewport = viewportRef.current
      if (
        nextViewport.width === previousViewport.width &&
        nextViewport.height === previousViewport.height
      ) {
        return
      }

      viewportRef.current = nextViewport
      setViewportSize(nextViewport)

      const activeZoom = zoomRef.current
      if (activeZoom === null || photoSize === null) return

      const nextPhotoRect = getContainedPhotoRect(nextViewport, photoSize)
      const nextFillScale = getFillScale(nextViewport, photoSize)
      if (nextPhotoRect === null) return

      const nextRange = getZoomRange(nextFillScale)
      const nextOrigin = focusPointForNormalizedFocus(
        activeZoom.focus,
        nextPhotoRect
      )
      const nextScale =
        activeZoom.mode === 'fill' && nextFillScale !== null
          ? nextFillScale
          : clampScale(activeZoom.scale, nextRange)
      const nextZoom = {
        ...activeZoom,
        origin: nextOrigin,
        pan: initialPanForFocus({
          viewport: nextViewport,
          photoRect: nextPhotoRect,
          scale: nextScale,
          origin: nextOrigin,
          anchor: {
            x: nextViewport.width / 2,
            y: nextViewport.height / 2,
          },
        }),
        scale: nextScale,
        fillScale: nextFillScale,
        range: nextRange,
      }
      zoomRef.current = nextZoom
      setZoom(nextZoom)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [photoSize])

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
    const nextViewport = readViewportSize()
    viewportRef.current = nextViewport
    setViewportSize(nextViewport)

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
      const requestedPan = {
        x: activeZoom.pan.x + delta.x,
        y: activeZoom.pan.y + delta.y,
      }
      const activePhotoRect =
        photoSize === null
          ? null
          : getContainedPhotoRect(viewportRef.current, photoSize)
      const nextPan =
        activePhotoRect === null
          ? {
              x: Math.max(
                -Math.max(
                  0,
                  (viewportRef.current.width * (activeZoom.scale - 1)) / 2
                ),
                Math.min(
                  Math.max(
                    0,
                    (viewportRef.current.width * (activeZoom.scale - 1)) / 2
                  ),
                  requestedPan.x
                )
              ),
              y: Math.max(
                -Math.max(
                  0,
                  (viewportRef.current.height * (activeZoom.scale - 1)) / 2
                ),
                Math.min(
                  Math.max(
                    0,
                    (viewportRef.current.height * (activeZoom.scale - 1)) / 2
                  ),
                  requestedPan.y
                )
              ),
            }
          : clampPan({
              viewport: viewportRef.current,
              photoRect: activePhotoRect,
              scale: activeZoom.scale,
              origin: activeZoom.origin,
              pan: requestedPan,
            })
      const nextFocus =
        activePhotoRect === null
          ? activeZoom.focus
          : normalizedFocusForPoint(
              clampPointToRect(
                {
                  x:
                    activeZoom.origin.x +
                    (viewportRef.current.width / 2 -
                      nextPan.x -
                      activeZoom.origin.x) /
                      activeZoom.scale,
                  y:
                    activeZoom.origin.y +
                    (viewportRef.current.height / 2 -
                      nextPan.y -
                      activeZoom.origin.y) /
                      activeZoom.scale,
                },
                activePhotoRect
              ),
              activePhotoRect
            )
      const nextZoom = {
        ...activeZoom,
        pan: nextPan,
        focus: nextFocus,
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

  const setZoomScale = (scale: number, requestedMode?: 'fill' | 'manual') => {
    const activeZoom = zoomRef.current
    if (activeZoom === null) return

    const isFillScale =
      fillScale !== null && Math.abs(scale - fillScale) <= FILL_SNAP_DISTANCE
    const mode = requestedMode ?? (isFillScale ? 'fill' : 'manual')
    const nextScale =
      mode === 'fill' && fillScale !== null
        ? fillScale
        : clampScale(scale, zoomRange)
    const nextOrigin =
      photoRect === null
        ? activeZoom.origin
        : focusPointForNormalizedFocus(activeZoom.focus, photoRect)
    const nextPan =
      photoRect === null
        ? activeZoom.pan
        : initialPanForFocus({
            viewport: viewportSize,
            photoRect,
            scale: nextScale,
            origin: nextOrigin,
            anchor: {
              x: viewportSize.width / 2,
              y: viewportSize.height / 2,
            },
          })
    const nextZoom = {
      ...activeZoom,
      origin: nextOrigin,
      pan: nextPan,
      scale: nextScale,
      mode,
      fillScale,
      range: zoomRange,
    }
    zoomRef.current = nextZoom
    setZoom(nextZoom)
  }

  const cycleZoomScale = () => {
    const activeZoom = zoomRef.current
    if (activeZoom === null) return

    const choices: ZoomChoice[] = [
      ...(fillScale === null ? [] : [{ kind: 'fill' as const }]),
      ...ZOOM_PRESETS.filter(
        preset =>
          fillScale === null ||
          Math.abs(preset - fillScale) > FILL_SNAP_DISTANCE
      ).map(value => ({ kind: 'scale' as const, value })),
    ]
    if (choices.length === 0) return

    const currentIndex =
      activeZoom.mode === 'fill'
        ? 0
        : choices.findIndex(
            choice =>
              choice.kind === 'scale' &&
              Math.abs(choice.value - activeZoom.scale) <= FILL_SNAP_DISTANCE
          )
    const nextChoice =
      choices[(currentIndex + 1) % choices.length] ?? choices[0]
    if (nextChoice.kind === 'fill') {
      setZoomScale(fillScale ?? DEFAULT_ZOOM_SCALE, 'fill')
    } else {
      setZoomScale(nextChoice.value, 'manual')
    }
  }

  const setZoomScaleForRailPointer = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const railHeight = Math.max(bounds.height, 1)
    const progress = Math.max(
      0,
      Math.min(1, (bounds.top + bounds.height - event.clientY) / railHeight)
    )
    const requestedScale =
      Math.round(
        (zoomRange.min + progress * (zoomRange.max - zoomRange.min)) * 10
      ) / 10
    const isFillScale =
      fillScale !== null &&
      Math.abs(requestedScale - fillScale) <= FILL_SNAP_DISTANCE
    setZoomScale(
      isFillScale ? fillScale : requestedScale,
      isFillScale ? 'fill' : 'manual'
    )
  }

  const targetMedia =
    motion.target === 'nextImage'
      ? nextMedia
      : motion.target === 'previousImage'
      ? previousMedia
      : null
  const navigationViewportSize =
    motion.axis === 'x' ? viewportRef.current.width : viewportRef.current.height
  const translations =
    motion.axis !== null && motion.target !== null
      ? getLayerTranslations(
          motion.axis,
          motion.offset,
          navigationViewportSize,
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
          data-zoom-mode={zoom?.mode}
          data-zoom-scale={zoom?.scale.toFixed(3)}
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
          data-zoom-min={zoom.range.min.toFixed(3)}
          data-zoom-max={zoom.range.max.toFixed(3)}
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
          <ZoomScaleMarker
            aria-hidden="true"
            style={{
              top: `${96 - zoomScaleProgress(zoom.scale, zoom.range) * 92}%`,
            }}
          />
          <ZoomScaleValue
            data-testid="present-zoom-scale-value"
            data-zoom-progress={zoomScaleProgress(
              zoom.scale,
              zoom.range
            ).toFixed(3)}
            data-zoom-semantic={zoom.mode === 'fill' ? 'fill' : undefined}
            style={{
              top: `${96 - zoomScaleProgress(zoom.scale, zoom.range) * 92}%`,
            }}
          >
            {zoom.mode === 'fill'
              ? t('present_view.zoom.fill', 'Fill screen')
              : `${zoom.scale}×`}
          </ZoomScaleValue>
        </ZoomScaleRail>
      )}
    </SwipeTrack>
  )
}

export default PresentSwipeTrack
