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
  title: `${id}.jpg`,
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
  window.localStorage.clear()
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

test('locks keyboard image navigation while a photo is zoomed', () => {
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
  for (const pointerId of [41, 42]) {
    fireEvent.pointerDown(track, {
      pointerId,
      button: 0,
      clientX: 200,
      clientY: 400,
    })
    fireEvent.pointerUp(track, {
      pointerId,
      clientX: 200,
      clientY: 400,
    })
  }

  expect(screen.getByTestId('present-zoomed-media')).toBeInTheDocument()

  fireEvent.keyDown(document, { key: 'ArrowRight' })
  fireEvent.keyDown(document, { key: 'ArrowLeft' })

  expect(dispatchMedia).not.toHaveBeenCalled()
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

test('shows the active position and filename without extra wording', () => {
  render(
    <PresentView
      media={media}
      activeIndex={1}
      dispatchMedia={vi.fn()}
      disableSaveCloseInHistory
    />
  )

  expect(screen.getByText('2 / 3')).toBeInTheDocument()
  expect(screen.getByText('current.jpg')).toBeInTheDocument()
  expect(screen.queryByText(/第|张/)).not.toBeInTheDocument()
})

test('quick settings toggle and persist position and filename independently', () => {
  render(
    <PresentView
      media={media}
      activeIndex={1}
      dispatchMedia={vi.fn()}
      disableSaveCloseInHistory
    />
  )

  const settingsButton = screen.getByRole('button', {
    name: 'Fullscreen display options',
  })
  expect(settingsButton).toHaveClass('hide')

  const track = screen.getByTestId('present-swipe-track')
  fireEvent.pointerDown(track, {
    pointerId: 9,
    button: 0,
    clientX: 200,
    clientY: 400,
  })
  fireEvent.pointerUp(track, {
    pointerId: 9,
    clientX: 200,
    clientY: 400,
  })
  expect(settingsButton).not.toHaveClass('hide')
  fireEvent.click(settingsButton)

  const positionSwitch = screen.getByRole('checkbox', {
    name: 'Show position',
  })
  const filenameSwitch = screen.getByRole('checkbox', {
    name: 'Show filename',
  })

  expect(positionSwitch).toBeChecked()
  expect(filenameSwitch).toBeChecked()

  fireEvent.click(positionSwitch)
  expect(screen.queryByText('2 / 3')).not.toBeInTheDocument()
  expect(screen.getByText('current.jpg')).toBeInTheDocument()

  fireEvent.click(filenameSwitch)
  expect(screen.queryByText('current.jpg')).not.toBeInTheDocument()

  expect(
    JSON.parse(
      window.localStorage.getItem('photoview.present-view.preferences') || ''
    )
  ).toEqual({ showPosition: false, showFilename: false })

  act(() => {
    vi.advanceTimersByTime(3000)
  })
  expect(
    screen.getByRole('group', { name: 'Fullscreen display' })
  ).toBeVisible()
})
