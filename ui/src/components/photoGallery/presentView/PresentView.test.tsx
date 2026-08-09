import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MediaType } from '../../../__generated__/globalTypes'
import { MediaGalleryFields } from '../__generated__/MediaGalleryFields'
import PresentView from './PresentView'
import { SidebarContext } from '../../sidebar/Sidebar'
import MediaSidebar from '../../sidebar/MediaSidebar/MediaSidebar'

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
  highRes: null,
  thumbnail: {
    __typename: 'MediaURL',
    url: `/${id}.jpg`,
    width: 400,
    height: 800,
  },
})

const media = [photo('previous'), photo('current'), photo('next')]

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 400,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 800,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
})

afterEach(() => {
  vi.clearAllTimers()
})

test('keeps keyboard navigation and close actions', () => {
  const dispatchMedia = vi.fn()
  render(
    <PresentView
      media={media}
      activeIndex={1}
      dispatchMedia={dispatchMedia}
      disableSaveCloseInHistory
    />
  )

  fireEvent.keyDown(document, { key: 'ArrowRight' })
  expect(dispatchMedia).toHaveBeenLastCalledWith({ type: 'nextImage' })

  fireEvent.keyDown(document, { key: 'ArrowLeft' })
  expect(dispatchMedia).toHaveBeenLastCalledWith({ type: 'previousImage' })

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(dispatchMedia).toHaveBeenLastCalledWith({ type: 'closePresentMode' })
})

test('passes the next item into the animated track before dispatching', () => {
  const dispatchMedia = vi.fn()
  render(
    <PresentView
      media={media}
      activeIndex={1}
      dispatchMedia={dispatchMedia}
      disableSaveCloseInHistory
    />
  )

  const track = screen.getByTestId('present-swipe-track')
  fireEvent.pointerDown(track, {
    pointerId: 1,
    button: 0,
    clientX: 200,
    clientY: 600,
  })
  fireEvent.pointerMove(track, {
    pointerId: 1,
    clientX: 200,
    clientY: 300,
  })

  const target = screen.getByTestId('present-swipe-target')
  expect(within(target).getByTestId('present-img-thumbnail')).toHaveAttribute(
    'src',
    'http://localhost:3000/next.jpg'
  )
  expect(dispatchMedia).not.toHaveBeenCalled()

  fireEvent.pointerUp(track, {
    pointerId: 1,
    clientX: 200,
    clientY: 300,
  })
  act(() => {
    vi.advanceTimersByTime(220)
  })

  expect(dispatchMedia).toHaveBeenCalledWith({ type: 'nextImage' })
})

test('a light tap reveals info for the active photo without closing it', () => {
  const dispatchMedia = vi.fn()
  const updateSidebar = vi.fn()

  render(
    <SidebarContext.Provider
      value={{
        updateSidebar,
        setPinned: vi.fn(),
        content: null,
        pinned: false,
      }}
    >
      <PresentView
        media={media}
        activeIndex={1}
        dispatchMedia={dispatchMedia}
        disableSaveCloseInHistory
      />
    </SidebarContext.Provider>
  )

  const infoButton = screen.getByRole('button', {
    name: 'Open photo details',
  })
  expect(infoButton).toHaveClass('hide')

  const track = screen.getByTestId('present-swipe-track')
  fireEvent.pointerDown(track, {
    pointerId: 7,
    button: 0,
    clientX: 200,
    clientY: 400,
  })
  fireEvent.pointerUp(track, {
    pointerId: 7,
    clientX: 200,
    clientY: 400,
  })

  expect(infoButton).not.toHaveClass('hide')
  fireEvent.click(infoButton)

  const details = updateSidebar.mock.calls[0][0] as React.ReactElement<{
    media: { id: string }
    hidePreview: boolean
  }>
  expect(details.type).toBe(MediaSidebar)
  expect(details.props).toMatchObject({
    media: { id: 'current' },
    hidePreview: true,
  })
  expect(dispatchMedia).not.toHaveBeenCalledWith({ type: 'closePresentMode' })
  expect(
    within(screen.getByTestId('present-swipe-current')).getByTestId(
      'present-img-thumbnail'
    )
  ).toHaveAttribute('src', 'http://localhost:3000/current.jpg')
})
