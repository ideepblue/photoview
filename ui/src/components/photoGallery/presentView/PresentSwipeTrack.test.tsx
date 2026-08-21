import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MediaType } from '../../../__generated__/globalTypes'
import { MediaGalleryFields } from '../__generated__/MediaGalleryFields'
import PresentSwipeTrack from './PresentSwipeTrack'

vi.useFakeTimers()

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number
  readonly pointerType: string
  readonly isPrimary: boolean

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
    this.pointerType = init.pointerType ?? 'touch'
    this.isPrimary = init.isPrimary ?? true
  }
}

Object.defineProperty(window, 'PointerEvent', {
  configurable: true,
  writable: true,
  value: TestPointerEvent,
})
Object.defineProperty(document.defaultView!, 'PointerEvent', {
  configurable: true,
  writable: true,
  value: TestPointerEvent,
})

const photo = (id: string): MediaGalleryFields => ({
  __typename: 'Media',
  id,
  type: MediaType.Photo,
  blurhash: null,
  favorite: false,
  videoWeb: null,
  highRes: {
    __typename: 'MediaURL',
    url: `/${id}-highres.jpg`,
  },
  thumbnail: {
    __typename: 'MediaURL',
    url: `/${id}-thumbnail.jpg`,
    width: 400,
    height: 800,
  },
})

const media = {
  current: photo('current'),
  next: photo('next'),
  previous: photo('previous'),
}

const setReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

const renderTrack = ({
  nextMedia = media.next,
  previousMedia = media.previous,
}: {
  nextMedia?: MediaGalleryFields | null
  previousMedia?: MediaGalleryFields | null
} = {}) => {
  const onNavigate = vi.fn()
  render(
    <PresentSwipeTrack
      currentMedia={media.current}
      nextMedia={nextMedia}
      previousMedia={previousMedia}
      onNavigate={onNavigate}
    />
  )

  return {
    onNavigate,
    track: screen.getByTestId('present-swipe-track'),
  }
}

const tapAt = (track: HTMLElement, pointerId: number, x: number, y: number) => {
  fireEvent.pointerDown(track, {
    pointerId,
    button: 0,
    clientX: x,
    clientY: y,
  })
  fireEvent.pointerUp(track, {
    pointerId,
    clientX: x,
    clientY: y,
  })
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 400,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 800,
  })
  setReducedMotion(false)
})

afterEach(() => {
  vi.clearAllTimers()
})

test.each([
  {
    name: 'left to next',
    start: [300, 400],
    move: [150, 400],
    currentTransform: 'translate3d(-150px, 0px, 0)',
    targetTransform: 'translate3d(250px, 0px, 0)',
    completedTransform: 'translate3d(-400px, 0px, 0)',
    targetId: 'next',
    navigation: 'nextImage',
  },
  {
    name: 'right to previous',
    start: [100, 400],
    move: [250, 400],
    currentTransform: 'translate3d(150px, 0px, 0)',
    targetTransform: 'translate3d(-250px, 0px, 0)',
    completedTransform: 'translate3d(400px, 0px, 0)',
    targetId: 'previous',
    navigation: 'previousImage',
  },
  {
    name: 'up to next',
    start: [200, 500],
    move: [200, 250],
    currentTransform: 'translate3d(0px, -250px, 0)',
    targetTransform: 'translate3d(0px, 550px, 0)',
    completedTransform: 'translate3d(0px, -800px, 0)',
    targetId: 'next',
    navigation: 'nextImage',
  },
  {
    name: 'down to previous',
    start: [200, 200],
    move: [200, 450],
    currentTransform: 'translate3d(0px, 250px, 0)',
    targetTransform: 'translate3d(0px, -550px, 0)',
    completedTransform: 'translate3d(0px, 800px, 0)',
    targetId: 'previous',
    navigation: 'previousImage',
  },
])('$name follows the pointer and settles before navigation', testCase => {
  const { onNavigate, track } = renderTrack()

  fireEvent.pointerDown(track, {
    pointerId: 1,
    button: 0,
    clientX: testCase.start[0],
    clientY: testCase.start[1],
  })
  fireEvent.pointerMove(track, {
    pointerId: 1,
    clientX: testCase.move[0],
    clientY: testCase.move[1],
  })

  expect(screen.getByTestId('present-swipe-current')).toHaveStyle(
    `transform: ${testCase.currentTransform}`
  )
  const target = screen.getByTestId('present-swipe-target')
  expect(target).toHaveStyle(`transform: ${testCase.targetTransform}`)
  expect(within(target).getByTestId('present-img-thumbnail')).toHaveAttribute(
    'src',
    `http://localhost:3000/${testCase.targetId}-thumbnail.jpg`
  )

  fireEvent.pointerUp(track, {
    pointerId: 1,
    clientX: testCase.move[0],
    clientY: testCase.move[1],
  })

  expect(screen.getByTestId('present-swipe-current')).toHaveStyle(
    `transform: ${testCase.completedTransform}`
  )
  expect(onNavigate).not.toHaveBeenCalled()

  act(() => {
    vi.advanceTimersByTime(220)
  })
  expect(onNavigate).toHaveBeenCalledTimes(1)
  expect(onNavigate).toHaveBeenCalledWith(testCase.navigation)
})

test('short drag rebounds without navigation', () => {
  const { onNavigate, track } = renderTrack()

  fireEvent.pointerDown(track, {
    pointerId: 1,
    button: 0,
    clientX: 200,
    clientY: 400,
  })
  fireEvent.pointerMove(track, {
    pointerId: 1,
    clientX: 180,
    clientY: 400,
  })
  fireEvent.pointerUp(track, {
    pointerId: 1,
    clientX: 180,
    clientY: 400,
  })

  expect(screen.getByTestId('present-swipe-current')).toHaveStyle(
    'transform: translate3d(0px, 0px, 0)'
  )
  act(() => {
    vi.advanceTimersByTime(180)
  })
  expect(onNavigate).not.toHaveBeenCalled()
  expect(screen.queryByTestId('present-swipe-target')).not.toBeInTheDocument()
})

test('diagonal movement locks to the dominant axis', () => {
  const { track } = renderTrack()

  fireEvent.pointerDown(track, {
    pointerId: 1,
    button: 0,
    clientX: 100,
    clientY: 100,
  })
  fireEvent.pointerMove(track, {
    pointerId: 1,
    clientX: 160,
    clientY: 120,
  })

  expect(screen.getByTestId('present-swipe-current')).toHaveStyle(
    'transform: translate3d(60px, 0px, 0)'
  )
})

test('pointer cancellation rebounds without navigation', () => {
  const { onNavigate, track } = renderTrack()

  fireEvent.pointerDown(track, {
    pointerId: 1,
    button: 0,
    clientX: 300,
    clientY: 400,
  })
  fireEvent.pointerMove(track, {
    pointerId: 1,
    clientX: 150,
    clientY: 400,
  })
  fireEvent.pointerCancel(track, { pointerId: 1 })

  act(() => {
    vi.advanceTimersByTime(180)
  })
  expect(onNavigate).not.toHaveBeenCalled()
  expect(screen.queryByTestId('present-swipe-target')).not.toBeInTheDocument()
})

test('ignores new gestures while the committed animation is settling', () => {
  const { onNavigate, track } = renderTrack()

  fireEvent.pointerDown(track, {
    pointerId: 1,
    button: 0,
    clientX: 300,
    clientY: 400,
  })
  fireEvent.pointerMove(track, {
    pointerId: 1,
    clientX: 150,
    clientY: 400,
  })
  fireEvent.pointerUp(track, {
    pointerId: 1,
    clientX: 150,
    clientY: 400,
  })

  fireEvent.pointerDown(track, {
    pointerId: 2,
    button: 0,
    clientX: 100,
    clientY: 400,
  })
  fireEvent.pointerMove(track, {
    pointerId: 2,
    clientX: 300,
    clientY: 400,
  })
  fireEvent.pointerUp(track, {
    pointerId: 2,
    clientX: 300,
    clientY: 400,
  })

  act(() => {
    vi.advanceTimersByTime(220)
  })
  expect(onNavigate).toHaveBeenCalledTimes(1)
  expect(onNavigate).toHaveBeenCalledWith('nextImage')
})

test('reduced motion commits without a settle delay', () => {
  setReducedMotion(true)
  const { onNavigate, track } = renderTrack()

  fireEvent.pointerDown(track, {
    pointerId: 1,
    button: 0,
    clientX: 200,
    clientY: 500,
  })
  fireEvent.pointerMove(track, {
    pointerId: 1,
    clientX: 200,
    clientY: 200,
  })
  fireEvent.pointerUp(track, {
    pointerId: 1,
    clientX: 200,
    clientY: 200,
  })

  expect(onNavigate).toHaveBeenCalledWith('nextImage')
})

test('does not navigate past a non-circular boundary', () => {
  const { onNavigate, track } = renderTrack({ nextMedia: null })

  fireEvent.pointerDown(track, {
    pointerId: 1,
    button: 0,
    clientX: 200,
    clientY: 500,
  })
  fireEvent.pointerMove(track, {
    pointerId: 1,
    clientX: 200,
    clientY: 200,
  })
  fireEvent.pointerUp(track, {
    pointerId: 1,
    clientX: 200,
    clientY: 200,
  })

  expect(screen.queryByTestId('present-swipe-target')).not.toBeInTheDocument()
  expect(onNavigate).not.toHaveBeenCalled()
})

test('double tap enters and exits the default 2.5x zoom mode', () => {
  const { track } = renderTrack()

  tapAt(track, 1, 200, 400)
  tapAt(track, 2, 200, 400)

  expect(screen.getByTestId('present-zoomed-media')).toHaveStyle(
    'transform: translate3d(0px, 0px, 0) scale(2.5)'
  )

  tapAt(track, 3, 200, 400)
  tapAt(track, 4, 200, 400)

  expect(screen.queryByTestId('present-zoomed-media')).not.toBeInTheDocument()
})

test('the zoom rail cycles the confirmed presets without re-enabling navigation', () => {
  const { onNavigate, track } = renderTrack()

  tapAt(track, 1, 200, 400)
  tapAt(track, 2, 200, 400)

  const rail = screen.getByTestId('present-zoom-scale-rail')
  fireEvent.pointerDown(rail, {
    pointerId: 3,
    button: 0,
    clientX: 360,
    clientY: 400,
  })
  fireEvent.pointerUp(rail, {
    pointerId: 3,
    clientX: 360,
    clientY: 400,
  })

  expect(screen.getByTestId('present-zoomed-media')).toHaveStyle(
    'transform: translate3d(0px, 0px, 0) scale(4)'
  )
  expect(onNavigate).not.toHaveBeenCalled()
})

test('dragging the zoom rail sets a continuous scale without cycling a preset', () => {
  const { track } = renderTrack()

  tapAt(track, 1, 200, 400)
  tapAt(track, 2, 200, 400)

  const rail = screen.getByTestId('present-zoom-scale-rail')
  Object.defineProperty(rail, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ top: 300, height: 160 }),
  })

  fireEvent.pointerDown(rail, {
    pointerId: 3,
    button: 0,
    clientX: 360,
    clientY: 420,
  })
  fireEvent.pointerMove(rail, {
    pointerId: 3,
    clientX: 360,
    clientY: 332,
  })
  fireEvent.pointerUp(rail, {
    pointerId: 3,
    clientX: 360,
    clientY: 332,
  })

  expect(screen.getByTestId('present-zoomed-media')).toHaveStyle(
    'transform: translate3d(0px, 0px, 0) scale(3.5)'
  )
})

test('panning a zoomed photo does not navigate to another image', () => {
  const { onNavigate, track } = renderTrack()

  tapAt(track, 1, 200, 400)
  tapAt(track, 2, 200, 400)

  fireEvent.pointerDown(track, {
    pointerId: 3,
    button: 0,
    clientX: 200,
    clientY: 400,
  })
  fireEvent.pointerMove(track, {
    pointerId: 3,
    clientX: 80,
    clientY: 400,
  })
  fireEvent.pointerMove(track, {
    pointerId: 3,
    clientX: 40,
    clientY: 400,
  })
  fireEvent.pointerUp(track, {
    pointerId: 3,
    clientX: 40,
    clientY: 400,
  })

  expect(screen.getByTestId('present-zoomed-media')).toHaveStyle(
    'transform: translate3d(-160px, 0px, 0) scale(2.5)'
  )
  expect(screen.queryByTestId('present-swipe-target')).not.toBeInTheDocument()
  expect(onNavigate).not.toHaveBeenCalled()
})
