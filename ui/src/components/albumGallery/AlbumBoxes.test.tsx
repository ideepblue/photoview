import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

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

test('places albums round-robin into two independent mobile lanes', () => {
  renderAlbums(albums)

  const gallery = screen.getByTestId('album-boxes')
  const lanes = screen.getAllByTestId('album-lane')

  expect(gallery).toHaveAttribute('data-mobile-layout', 'columns-2')
  expect(gallery).toHaveClass('mobile-album-lanes-2', 'xs:block', 'xs:-mx-3')
  expect(lanes).toHaveLength(2)
  expect(laneLinks(lanes[0])).toEqual([
    '/album/album-1',
    '/album/album-3',
    '/album/album-5',
    '/album/album-7',
  ])
  expect(laneLinks(lanes[1])).toEqual([
    '/album/album-2',
    '/album/album-4',
    '/album/album-6',
    '/album/album-8',
  ])
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

test('places albums round-robin into three independent mobile lanes', async () => {
  const user = userEvent.setup()
  renderAlbums(albums)

  await user.click(screen.getByRole('button', { name: '3 columns' }))

  const lanes = screen.getAllByTestId('album-lane')

  expect(lanes).toHaveLength(3)
  expect(laneLinks(lanes[0])).toEqual([
    '/album/album-1',
    '/album/album-4',
    '/album/album-7',
  ])
  expect(laneLinks(lanes[1])).toEqual([
    '/album/album-2',
    '/album/album-5',
    '/album/album-8',
  ])
  expect(laneLinks(lanes[2])).toEqual(['/album/album-3', '/album/album-6'])
})

test('places albums round-robin into four independent mobile lanes', async () => {
  const user = userEvent.setup()
  renderAlbums(albums)

  await user.click(screen.getByRole('button', { name: '4 columns' }))

  expect(screen.getByTestId('album-boxes')).toHaveAttribute(
    'data-mobile-layout',
    'columns-4'
  )
  expect(screen.getByTestId('album-boxes')).toHaveClass('mobile-album-lanes-4')
  const lanes = screen.getAllByTestId('album-lane')

  expect(lanes).toHaveLength(4)
  expect(laneLinks(lanes[0])).toEqual(['/album/album-1', '/album/album-5'])
  expect(laneLinks(lanes[1])).toEqual(['/album/album-2', '/album/album-6'])
  expect(laneLinks(lanes[2])).toEqual(['/album/album-3', '/album/album-7'])
  expect(laneLinks(lanes[3])).toEqual(['/album/album-4', '/album/album-8'])
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
