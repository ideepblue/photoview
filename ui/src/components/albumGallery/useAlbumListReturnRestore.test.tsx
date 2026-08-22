import React, { useRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  albumListPresentationKey,
  saveAlbumListReturnRecord,
} from './albumListReturnContext'
import {
  albumListRestoreScrollTarget,
  useAlbumListReturnRestore,
} from './useAlbumListReturnRestore'

const parentListKey = '/album/parent'
const presentationKey = albumListPresentationKey(
  parentListKey,
  '?viewed=viewed',
  'columns-2'
)

const saveRecord = (overrides = {}) =>
  saveAlbumListReturnRecord({
    parentListKey,
    presentationKey,
    albumId: 'child',
    albumTitle: 'Child album',
    scrollY: 180,
    cardViewportOffset: 70,
    updatedAt: 100,
    ...overrides,
  })

const RestoreHarness = ({
  showCard = true,
  restore = true,
}: {
  showCard?: boolean
  restore?: boolean
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const restoredAlbum = useAlbumListReturnRestore({
    parentListKey,
    presentationKey,
    albumsReady: true,
    shouldRestore: restore,
    rootRef,
  })

  return (
    <div ref={rootRef}>
      {showCard && <div data-album-id="child">Child album</div>}
      <output data-testid="restored-album">{restoredAlbum?.albumId}</output>
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 100,
  })
  window.scrollTo = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

test('uses the card anchor before the raw scroll fallback', () => {
  expect(
    albumListRestoreScrollTarget({
      scrollY: 100,
      cardTop: 220,
      cardViewportOffset: 70,
      fallbackScrollY: 180,
    })
  ).toBe(250)
})

test('uses the stored scroll position when the remembered card is gone', () => {
  expect(
    albumListRestoreScrollTarget({
      scrollY: 100,
      cardTop: undefined,
      cardViewportOffset: 70,
      fallbackScrollY: 180,
    })
  ).toBe(180)
})

test('restores the card after the list has settled and announces the card id', () => {
  saveRecord()
  render(<RestoreHarness />)
  const card = screen.getByText('Child album')
  card.getBoundingClientRect = () => ({ top: 220 } as DOMRect)

  act(() => {
    vi.advanceTimersByTime(100)
  })

  expect(window.scrollTo).toHaveBeenCalledWith({ top: 250, behavior: 'auto' })
  expect(screen.getByTestId('restored-album')).toHaveTextContent('child')
})

test('falls back safely when a current filter removes the remembered card', () => {
  saveRecord()
  render(<RestoreHarness showCard={false} />)

  act(() => {
    vi.advanceTimersByTime(100)
  })

  expect(window.scrollTo).toHaveBeenCalledWith({ top: 180, behavior: 'auto' })
  expect(screen.getByTestId('restored-album')).toBeEmptyDOMElement()
})

test('does not move a directly opened list or fight user input', () => {
  saveRecord()
  const direct = render(<RestoreHarness restore={false} />)

  act(() => {
    vi.advanceTimersByTime(100)
  })
  expect(window.scrollTo).not.toHaveBeenCalled()

  direct.unmount()
  render(<RestoreHarness />)
  fireEvent.wheel(window)

  act(() => {
    vi.advanceTimersByTime(100)
  })
  expect(window.scrollTo).not.toHaveBeenCalled()
})
