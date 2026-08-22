import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  MemoryRouter,
  unstable_HistoryRouter as HistoryRouter,
  useLocation,
} from 'react-router-dom'
import { createMemoryHistory } from 'history'
import AlbumBoxes from './AlbumBoxes'
import {
  ALBUM_LIST_RETURN_CONTEXT_STORAGE_KEY,
  albumListPresentationKey,
  getAlbumListReturnRecord,
  getAlbumListReturnTarget,
  hasAlbumListRestoreIntent,
  saveAlbumListReturnRecord,
  withAlbumListRestoreIntent,
} from './albumListReturnContext'

const albums = [
  {
    id: 'album-1',
    title: 'First album',
    thumbnail: {
      thumbnail: {
        url: '/first.jpg',
        width: 800,
        height: 1200,
      },
    },
  },
  {
    id: 'album-2',
    title: 'Second album',
    thumbnail: {
      thumbnail: {
        url: '/second.jpg',
        width: 800,
        height: 1200,
      },
    },
  },
]

const LocationState = () => {
  const location = useLocation()
  return (
    <output data-testid="location-state">
      {JSON.stringify({
        pathname: location.pathname,
        search: location.search,
        state: location.state,
      })}
    </output>
  )
}

type AlbumListLocationState = {
  pathname: string
  search: string
  state: unknown
}

const readLocationState = () =>
  JSON.parse(
    screen.getByTestId('location-state').textContent || '{}'
  ) as AlbumListLocationState

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 180,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

test('captures the current parent list and marks the opened child on return', async () => {
  const firstRender = render(
    <MemoryRouter initialEntries={['/albums?albumOrderBy=view_count']}>
      <AlbumBoxes albums={albums} />
      <LocationState />
    </MemoryRouter>
  )

  const firstAlbum = screen.getByRole('link', { name: /First album/ })
  firstAlbum.getBoundingClientRect = () => ({ top: 68 } as DOMRect)

  fireEvent.click(firstAlbum)

  await waitFor(() =>
    expect(getAlbumListReturnRecord('/albums')).toMatchObject({
      albumId: 'album-1',
      albumTitle: 'First album',
      scrollY: 180,
      cardViewportOffset: 68,
    })
  )

  const location = readLocationState()
  expect(location.pathname).toBe('/album/album-1')
  expect(getAlbumListReturnTarget(location.state, '/albums')).toEqual({
    parentListKey: '/albums',
    to: '/albums?albumOrderBy=view_count',
  })

  firstRender.unmount()
  render(
    <MemoryRouter initialEntries={['/albums?albumOrderBy=view_count']}>
      <AlbumBoxes albums={albums} />
    </MemoryRouter>
  )

  expect(screen.getByRole('link', { name: /First album/ })).toHaveAttribute(
    'data-last-opened',
    'true'
  )
  expect(screen.getByLabelText('Last opened')).toBeInTheDocument()
})

test('keeps the parent history entry ready for browser-back restoration', async () => {
  const history = createMemoryHistory({
    initialEntries: ['/album/parent?viewed=viewed'],
  })
  render(
    <HistoryRouter history={history}>
      <AlbumBoxes albums={albums} />
    </HistoryRouter>
  )

  fireEvent.click(screen.getByRole('link', { name: /Second album/ }))

  await waitFor(() =>
    expect(getAlbumListReturnRecord('/album/parent')?.albumId).toBe('album-2')
  )

  const storedHistory = JSON.parse(
    window.localStorage.getItem(ALBUM_LIST_RETURN_CONTEXT_STORAGE_KEY) || '{}'
  ) as Record<string, { albumId?: unknown }>
  expect(storedHistory['/album/parent']?.albumId).toBe('album-2')

  await waitFor(() => expect(history.location.pathname).toBe('/album/album-2'))
  act(() => {
    history.go(-1)
  })

  expect(history.location.pathname).toBe('/album/parent')
  expect(history.location.search).toBe('?viewed=viewed')
  expect(hasAlbumListRestoreIntent(history.location.state)).toBe(true)
})

test('restores the returned card after the albums render', () => {
  vi.useFakeTimers()
  const scrollTo = vi.fn()
  window.scrollTo = scrollTo
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 100,
  })
  saveAlbumListReturnRecord({
    parentListKey: '/albums',
    presentationKey: albumListPresentationKey(
      '/albums',
      '?albumOrderBy=view_count',
      'columns-2'
    ),
    albumId: 'album-2',
    albumTitle: 'Second album',
    scrollY: 180,
    cardViewportOffset: 70,
    updatedAt: 100,
  })
  const history = createMemoryHistory({
    initialEntries: ['/albums?albumOrderBy=view_count'],
  })
  history.replace(
    '/albums?albumOrderBy=view_count',
    withAlbumListRestoreIntent(undefined)
  )

  render(
    <HistoryRouter history={history}>
      <AlbumBoxes albums={albums} />
    </HistoryRouter>
  )

  const secondAlbum = screen.getByRole('link', { name: /Second album/ })
  secondAlbum.getBoundingClientRect = () => ({ top: 220 } as DOMRect)

  act(() => {
    vi.advanceTimersByTime(100)
  })

  expect(scrollTo).toHaveBeenCalledWith({ top: 250, behavior: 'auto' })
  expect(secondAlbum).toHaveAttribute('data-last-opened', 'true')
  expect(secondAlbum).toHaveAttribute('data-return-restored', 'true')
  expect(screen.getByRole('status')).toHaveTextContent(
    'Returned to Second album'
  )
})
