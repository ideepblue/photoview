import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MockedProvider } from '@apollo/client/testing'
import {
  SET_ALBUM_FEATURED_MUTATION,
} from '../album/AlbumFeaturedButton'

import { albumQuery_album_subAlbums } from '../../Pages/AlbumPage/__generated__/albumQuery'
import AlbumBoxes from './AlbumBoxes'
import { MOBILE_ALBUM_LAYOUT_KEY } from './mobileAlbumLayout'

const album = {
  __typename: 'Album',
  id: 'album-1',
  title: 'Portrait album',
  thumbnail: {
    __typename: 'Media',
    id: 'cover-1',
    thumbnail: {
      __typename: 'MediaURL',
      url: '/portrait.jpg',
      width: 800,
      height: 1200,
    },
  },
} as unknown as albumQuery_album_subAlbums

const albums = Array.from({ length: 8 }, (_, index) => ({
  ...album,
  id: `album-${index + 1}`,
  title: `Album ${index + 1}`,
  thumbnail: {
    ...album.thumbnail,
    id: `cover-${index + 1}`,
    thumbnail: {
      ...album.thumbnail?.thumbnail,
      url: `/album-${index + 1}.jpg`,
    },
  },
})) as albumQuery_album_subAlbums[]

const masonryAlbums = albums.map((item, index) => ({
  ...item,
  thumbnail: {
    ...item.thumbnail,
    thumbnail: {
      ...item.thumbnail?.thumbnail,
      width: 1000,
      height: index === 0 ? 3000 : 1000,
    },
  },
})) as albumQuery_album_subAlbums[]

const albumsWithMissingCoverSize = [
  {
    ...albums[0],
    thumbnail: {
      ...albums[0].thumbnail,
      thumbnail: {
        ...albums[0].thumbnail?.thumbnail,
        width: null,
        height: null,
      },
    },
  },
  {
    ...albums[1],
    thumbnail: {
      ...albums[1].thumbnail,
      thumbnail: {
        ...albums[1].thumbnail?.thumbnail,
        width: 1000,
        height: 1000,
      },
    },
  },
  {
    ...albums[2],
    thumbnail: {
      ...albums[2].thumbnail,
      thumbnail: {
        ...albums[2].thumbnail?.thumbnail,
        width: 1000,
        height: 3000,
      },
    },
  },
  {
    ...albums[3],
    thumbnail: {
      ...albums[3].thumbnail,
      thumbnail: {
        ...albums[3].thumbnail?.thumbnail,
        width: 1000,
        height: 1000,
      },
    },
  },
] as unknown as albumQuery_album_subAlbums[]

const renderAlbums = (items: albumQuery_album_subAlbums[] = [album]) =>
  render(
    <MemoryRouter>
      <AlbumBoxes albums={items} />
    </MemoryRouter>
  )

const laneLinks = (lane: HTMLElement) =>
  within(lane)
    .getAllByRole('link')
    .map(link => link.getAttribute('href'))

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 390,
  })
})

test('places every album into the shortest of two mobile lanes', () => {
  renderAlbums(masonryAlbums)

  const gallery = screen.getByTestId('album-boxes')
  const lanes = screen.getAllByTestId('album-lane')

  expect(gallery).toHaveAttribute('data-mobile-layout', 'columns-2')
  expect(gallery).toHaveClass('mobile-album-lanes-2', 'xs:block', 'xs:-mx-3')
  expect(lanes).toHaveLength(2)
  expect(laneLinks(lanes[0])).toEqual([
    '/album/album-1',
    '/album/album-5',
    '/album/album-7',
  ])
  expect(laneLinks(lanes[1])).toEqual([
    '/album/album-2',
    '/album/album-3',
    '/album/album-4',
    '/album/album-6',
    '/album/album-8',
  ])
})

test('breaks equal-height lane ties from left to right', () => {
  renderAlbums(albums.slice(0, 4))

  const lanes = screen.getAllByTestId('album-lane')

  expect(laneLinks(lanes[0])).toEqual(['/album/album-1', '/album/album-3'])
  expect(laneLinks(lanes[1])).toEqual(['/album/album-2', '/album/album-4'])
})

test('uses the existing 3:4 placeholder ratio when cover dimensions are missing', () => {
  renderAlbums(albumsWithMissingCoverSize)

  const lanes = screen.getAllByTestId('album-lane')

  expect(laneLinks(lanes[0])).toEqual(['/album/album-1', '/album/album-4'])
  expect(laneLinks(lanes[1])).toEqual(['/album/album-2', '/album/album-3'])
})

test('keeps natural covers and the existing desktop card dimensions', () => {
  renderAlbums()

  const card = screen.getByRole('link', { name: /Portrait album/ })
  const thumbnail = screen.getByTestId('album-cover-frame')

  expect(card).toHaveClass(
    'mobile-album-card',
    'xs:inline-block',
    'xs:w-[220px]'
  )
  expect(thumbnail).toHaveStyle({
    '--album-cover-aspect-ratio': '800 / 1200',
  })
  expect(thumbnail).toHaveClass('xs:h-[220px]', 'xs:w-[220px]')
  expect(screen.getByText('Album')).toBeInTheDocument()
})

test('offers list, two, three, and four column choices and persists changes', async () => {
  const user = userEvent.setup()
  const { unmount } = renderAlbums()

  expect(screen.getByRole('button', { name: '2 columns' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(screen.getByRole('button', { name: 'Compact list' })).toBeVisible()
  expect(screen.getByRole('button', { name: '3 columns' })).toBeVisible()
  expect(screen.getByRole('button', { name: '4 columns' })).toBeVisible()

  await user.click(screen.getByRole('button', { name: '3 columns' }))

  expect(screen.getByTestId('album-boxes')).toHaveAttribute(
    'data-mobile-layout',
    'columns-3'
  )
  expect(screen.getByTestId('album-boxes')).toHaveClass('mobile-album-lanes-3')
  expect(window.localStorage.getItem(MOBILE_ALBUM_LAYOUT_KEY)).toBe('columns-3')

  unmount()
  renderAlbums()

  expect(screen.getByRole('button', { name: '3 columns' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('places every album into the shortest of three mobile lanes', async () => {
  const user = userEvent.setup()
  renderAlbums(masonryAlbums)

  await user.click(screen.getByRole('button', { name: '3 columns' }))

  const lanes = screen.getAllByTestId('album-lane')

  expect(lanes).toHaveLength(3)
  expect(laneLinks(lanes[0])).toEqual(['/album/album-1', '/album/album-8'])
  expect(laneLinks(lanes[1])).toEqual([
    '/album/album-2',
    '/album/album-4',
    '/album/album-6',
  ])
  expect(laneLinks(lanes[2])).toEqual([
    '/album/album-3',
    '/album/album-5',
    '/album/album-7',
  ])
})

test('places every album into the shortest of four mobile lanes', async () => {
  const user = userEvent.setup()
  renderAlbums(masonryAlbums)

  await user.click(screen.getByRole('button', { name: '4 columns' }))

  expect(screen.getByTestId('album-boxes')).toHaveAttribute(
    'data-mobile-layout',
    'columns-4'
  )
  expect(screen.getByTestId('album-boxes')).toHaveClass('mobile-album-lanes-4')
  const lanes = screen.getAllByTestId('album-lane')

  expect(lanes).toHaveLength(4)
  expect(laneLinks(lanes[0])).toEqual(['/album/album-1'])
  expect(laneLinks(lanes[1])).toEqual([
    '/album/album-2',
    '/album/album-5',
    '/album/album-8',
  ])
  expect(laneLinks(lanes[2])).toEqual(['/album/album-3', '/album/album-6'])
  expect(laneLinks(lanes[3])).toEqual(['/album/album-4', '/album/album-7'])
})

test('keeps albums flat and in source order on desktop widths', () => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 800,
  })

  renderAlbums(albums)

  expect(screen.queryAllByTestId('album-lane')).toHaveLength(0)
  expect(
    screen.getAllByRole('link').map(link => link.getAttribute('href'))
  ).toEqual([
    '/album/album-1',
    '/album/album-2',
    '/album/album-3',
    '/album/album-4',
    '/album/album-5',
    '/album/album-6',
    '/album/album-7',
    '/album/album-8',
  ])
})

test('restores the flat source order after resizing to desktop', () => {
  renderAlbums(albums)

  expect(screen.getAllByTestId('album-lane')).toHaveLength(2)

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 800,
  })
  fireEvent(window, new Event('resize'))

  expect(screen.queryAllByTestId('album-lane')).toHaveLength(0)
  expect(
    screen.getAllByRole('link').map(link => link.getAttribute('href'))
  ).toEqual([
    '/album/album-1',
    '/album/album-2',
    '/album/album-3',
    '/album/album-4',
    '/album/album-5',
    '/album/album-6',
    '/album/album-7',
    '/album/album-8',
  ])
})

test('uses a compact horizontal card in list mode', async () => {
  const user = userEvent.setup()
  renderAlbums()

  await user.click(screen.getByRole('button', { name: 'Compact list' }))

  expect(screen.getByTestId('album-boxes')).toHaveClass('mobile-album-list')
  expect(screen.getByRole('link', { name: /Portrait album/ })).toHaveClass(
    'mobile-album-card-list'
  )
  expect(screen.getByTestId('album-cover-frame')).toHaveClass('h-20', 'w-20')
  expect(screen.queryAllByTestId('album-lane')).toHaveLength(0)
})

test('shows a view count and featured control without navigating the card', async () => {
  const user = userEvent.setup()
  const engagedAlbum = {
    ...album,
    viewerState: {
      __typename: 'AlbumViewerState',
      featured: false,
      viewCount: 7,
      lastViewedAt: '2026-08-16T12:00:00Z',
    },
  } as albumQuery_album_subAlbums

  render(
    <MockedProvider
      addTypename={false}
      mocks={[
        {
          request: {
            query: SET_ALBUM_FEATURED_MUTATION,
            variables: { albumId: 'album-1', featured: true },
          },
          result: {
            data: {
              setAlbumFeatured: {
                __typename: 'AlbumViewerState',
                featured: true,
                viewCount: 7,
                lastViewedAt: '2026-08-16T12:00:00Z',
              },
            },
          },
        },
      ]}
    >
      <MemoryRouter initialEntries={['/albums']}>
        <AlbumBoxes albums={[engagedAlbum]} />
      </MemoryRouter>
    </MockedProvider>
  )

  expect(screen.getByLabelText('Viewed 7 times')).toBeVisible()
  expect(screen.getByRole('link', { name: /Portrait album/ })).toHaveAttribute(
    'href',
    '/album/album-1'
  )

  await user.click(
    screen.getByRole('button', { name: 'Add album to featured' })
  )

  expect(
    screen.getByRole('link', { name: /Portrait album/ })
  ).toBeInTheDocument()
})

test('hides the viewed badge when the count is zero', () => {
  const unviewedAlbum = {
    ...album,
    viewerState: {
      __typename: 'AlbumViewerState',
      featured: false,
      viewCount: 0,
      lastViewedAt: null,
    },
  } as albumQuery_album_subAlbums

  render(
    <MockedProvider>
      <MemoryRouter>
        <AlbumBoxes albums={[unviewedAlbum]} />
      </MemoryRouter>
    </MockedProvider>
  )

  expect(screen.queryByLabelText(/Viewed .* times/)).not.toBeInTheDocument()
})
