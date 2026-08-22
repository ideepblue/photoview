import {
  clampPan,
  clampPointToRect,
  getContainedPhotoRect,
  getFillScale,
  getZoomRange,
  initialPanForFocus,
} from './zoomGeometry'

const viewport = { width: 400, height: 800 }

test('computes the cover scale from the contained photo rectangle', () => {
  expect(getContainedPhotoRect(viewport, { width: 1600, height: 900 })).toEqual(
    {
      x: 0,
      y: 287.5,
      width: 400,
      height: 225,
    }
  )
  expect(getFillScale(viewport, { width: 1600, height: 900 })).toBeCloseTo(
    800 / 225
  )
})

test('allows a semantic fill scale above the manual four-times range', () => {
  const fillScale = getFillScale(viewport, { width: 2400, height: 800 })

  expect(fillScale).toBeCloseTo(6)
  expect(getZoomRange(fillScale).min).toBe(1.1)
  expect(getZoomRange(fillScale).max).toBeCloseTo(6)
})

test('lets an image that already matches the viewport fill at one-times', () => {
  const fillScale = getFillScale(viewport, { width: 400, height: 800 })

  expect(fillScale).toBe(1)
  expect(getZoomRange(fillScale)).toEqual({ min: 1, max: 4 })
})

test('clamps the double-tap focus into the contained image', () => {
  const photoRect = getContainedPhotoRect(viewport, {
    width: 1600,
    height: 900,
  })

  expect(photoRect).not.toBeNull()
  expect(clampPointToRect({ x: -20, y: 900 }, photoRect!)).toEqual({
    x: 0,
    y: 512.5,
  })
})

test('keeps an interior double-tap focus while keeping the image gap-free', () => {
  const photoRect = getContainedPhotoRect(viewport, {
    width: 1600,
    height: 900,
  })
  const fillScale = getFillScale(viewport, { width: 1600, height: 900 })
  const origin = { x: 100, y: 400 }
  const pan = initialPanForFocus({
    viewport,
    photoRect: photoRect!,
    scale: fillScale!,
    origin,
  })

  expect(pan.x).toBeCloseTo(0)
  expect(pan.y).toBeCloseTo(0)
  expect(
    initialPanForFocus({
      viewport,
      photoRect: photoRect!,
      scale: fillScale!,
      origin,
      anchor: { x: viewport.width / 2, y: viewport.height / 2 },
    }).x
  ).toBeCloseTo(100)
  const clampedPan = clampPan({
    viewport,
    photoRect: photoRect!,
    scale: fillScale!,
    origin,
    pan: { x: 10_000, y: 10_000 },
  })
  expect(clampedPan.x).toBeCloseTo(255.55555555555554)
  expect(clampedPan.y).toBeCloseTo(0)
})
