export type ZoomSize = {
  width: number
  height: number
}

export type ZoomPoint = {
  x: number
  y: number
}

export type ZoomRect = ZoomPoint & ZoomSize

export type ZoomRange = {
  min: number
  max: number
}

export const MIN_ZOOM_SCALE = 1.1
export const MAX_ZOOM_SCALE = 4

const isPositiveSize = ({ width, height }: ZoomSize) =>
  Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0

export const getContainedPhotoRect = (
  viewport: ZoomSize,
  photo: ZoomSize
): ZoomRect | null => {
  if (!isPositiveSize(viewport) || !isPositiveSize(photo)) return null

  const containScale = Math.min(
    viewport.width / photo.width,
    viewport.height / photo.height
  )
  const width = photo.width * containScale
  const height = photo.height * containScale

  return {
    x: (viewport.width - width) / 2,
    y: (viewport.height - height) / 2,
    width,
    height,
  }
}

export const getFillScale = (
  viewport: ZoomSize,
  photo: ZoomSize
): number | null => {
  const containedPhoto = getContainedPhotoRect(viewport, photo)
  if (containedPhoto === null) return null

  return Math.max(
    1,
    viewport.width / containedPhoto.width,
    viewport.height / containedPhoto.height
  )
}

export const getZoomRange = (fillScale: number | null): ZoomRange => {
  if (fillScale === null || !Number.isFinite(fillScale)) {
    return { min: MIN_ZOOM_SCALE, max: MAX_ZOOM_SCALE }
  }

  return {
    min: Math.min(MIN_ZOOM_SCALE, fillScale),
    max: Math.max(MAX_ZOOM_SCALE, fillScale),
  }
}

export const clampPointToRect = (
  point: ZoomPoint,
  rect: ZoomRect
): ZoomPoint => ({
  x: Math.max(rect.x, Math.min(rect.x + rect.width, point.x)),
  y: Math.max(rect.y, Math.min(rect.y + rect.height, point.y)),
})

type PanBounds = {
  min: number
  max: number
}

const getPanBounds = (
  viewportStart: number,
  viewportSize: number,
  photoStart: number,
  photoSize: number,
  scale: number,
  origin: number
): PanBounds => {
  const transformedStart = origin + (photoStart - origin) * scale
  const transformedEnd = origin + (photoStart + photoSize - origin) * scale
  const minPan = viewportStart + viewportSize - transformedEnd
  const maxPan = viewportStart - transformedStart

  if (minPan <= maxPan) return { min: minPan, max: maxPan }

  const centeredPan = (minPan + maxPan) / 2
  return { min: centeredPan, max: centeredPan }
}

export const clampPan = ({
  viewport,
  photoRect,
  scale,
  origin,
  pan,
}: {
  viewport: ZoomSize
  photoRect: ZoomRect
  scale: number
  origin: ZoomPoint
  pan: ZoomPoint
}): ZoomPoint => {
  const xBounds = getPanBounds(
    0,
    viewport.width,
    photoRect.x,
    photoRect.width,
    scale,
    origin.x
  )
  const yBounds = getPanBounds(
    0,
    viewport.height,
    photoRect.y,
    photoRect.height,
    scale,
    origin.y
  )

  return {
    x: Math.max(xBounds.min, Math.min(xBounds.max, pan.x)),
    y: Math.max(yBounds.min, Math.min(yBounds.max, pan.y)),
  }
}

export const initialPanForFocus = ({
  viewport,
  photoRect,
  scale,
  origin,
  anchor = origin,
}: {
  viewport: ZoomSize
  photoRect: ZoomRect
  scale: number
  origin: ZoomPoint
  anchor?: ZoomPoint
}): ZoomPoint =>
  clampPan({
    viewport,
    photoRect,
    scale,
    origin,
    pan: {
      x: anchor.x - origin.x,
      y: anchor.y - origin.y,
    },
  })
