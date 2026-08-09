import {
  completionOffset,
  getLayerTranslations,
  lockSwipeAxis,
  navigationForOffset,
  shouldCommitSwipe,
} from './swipeMotion'

describe('swipe motion', () => {
  test.each([
    [{ x: 9, y: 8 }, null],
    [{ x: 11, y: 6 }, 'x'],
    [{ x: 4, y: -12 }, 'y'],
    [{ x: -14, y: 14 }, 'x'],
  ] as const)('locks the dominant axis for %#', (delta, expected) => {
    expect(lockSwipeAxis(delta)).toBe(expected)
  })

  test.each([
    [-1, 'nextImage'],
    [1, 'previousImage'],
    [0, null],
  ] as const)('maps offset %s to navigation %s', (offset, expected) => {
    expect(navigationForOffset(offset)).toBe(expected)
  })

  test('positions the next item to the right during a left drag', () => {
    expect(getLayerTranslations('x', -80, 400, 'nextImage')).toEqual({
      current: { x: -80, y: 0 },
      target: { x: 320, y: 0 },
    })
  })

  test('positions the previous item above during a down drag', () => {
    expect(getLayerTranslations('y', 120, 800, 'previousImage')).toEqual({
      current: { x: 0, y: 120 },
      target: { x: 0, y: -680 },
    })
  })

  test.each([
    [89, 400, 0.1, true],
    [80, 400, 0.1, false],
    [45, 400, 0.56, true],
    [39, 400, 2, false],
    [-89, 400, -0.1, true],
  ] as const)(
    'commit decision for distance=%s viewport=%s velocity=%s is %s',
    (distance, viewport, velocity, expected) => {
      expect(shouldCommitSwipe(distance, viewport, velocity)).toBe(expected)
    }
  )

  test('returns the correct completed page offset', () => {
    expect(completionOffset('nextImage', 400)).toBe(-400)
    expect(completionOffset('previousImage', 400)).toBe(400)
  })
})
