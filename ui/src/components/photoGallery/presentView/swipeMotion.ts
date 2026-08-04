export const SWIPE_AXIS_LOCK_PX = 10
export const SWIPE_DISTANCE_RATIO = 0.22
export const SWIPE_MIN_FLING_PX = 40
export const SWIPE_VELOCITY_PX_PER_MS = 0.55

export type SwipeAxis = 'x' | 'y'
export type SwipeNavigation = 'nextImage' | 'previousImage'
export type SwipePoint = { x: number; y: number }

export type SwipeLayerTranslations = {
  current: SwipePoint
  target: SwipePoint
}

export const lockSwipeAxis = (delta: SwipePoint): SwipeAxis | null => {
  const absoluteX = Math.abs(delta.x)
  const absoluteY = Math.abs(delta.y)

  if (Math.max(absoluteX, absoluteY) < SWIPE_AXIS_LOCK_PX) {
    return null
  }

  return absoluteX >= absoluteY ? 'x' : 'y'
}

export const navigationForOffset = (
  offset: number
): SwipeNavigation | null => {
  if (offset === 0) return null
  return offset < 0 ? 'nextImage' : 'previousImage'
}

export const getLayerTranslations = (
  axis: SwipeAxis,
  offset: number,
  viewportSize: number,
  navigation: SwipeNavigation
): SwipeLayerTranslations => {
  const targetOrigin =
    navigation === 'nextImage' ? viewportSize : -viewportSize

  if (axis === 'x') {
    return {
      current: { x: offset, y: 0 },
      target: { x: targetOrigin + offset, y: 0 },
    }
  }

  return {
    current: { x: 0, y: offset },
    target: { x: 0, y: targetOrigin + offset },
  }
}

export const shouldCommitSwipe = (
  offset: number,
  viewportSize: number,
  velocity: number
): boolean => {
  if (viewportSize <= 0) return false

  const distance = Math.abs(offset)
  return (
    distance / viewportSize >= SWIPE_DISTANCE_RATIO ||
    (distance >= SWIPE_MIN_FLING_PX &&
      Math.abs(velocity) >= SWIPE_VELOCITY_PX_PER_MS)
  )
}

export const completionOffset = (
  navigation: SwipeNavigation,
  viewportSize: number
): number => (navigation === 'nextImage' ? -viewportSize : viewportSize)
