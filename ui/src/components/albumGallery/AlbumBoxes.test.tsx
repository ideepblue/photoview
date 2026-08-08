import React from 'react'
import { render, screen } from '@testing-library/react'
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

const renderAlbums = () =>
  render(
    <MemoryRouter>
      <AlbumBoxes albums={[album]} />
    </MemoryRouter>
  )

beforeEach(() => {
  window.localStorage.clear()
})

test('defaults to a mobile two-column grid and keeps desktop flow', () => {
  renderAlbums()

  const gallery = screen.getByTestId('album-boxes')
  const card = screen.getByRole('link', { name: /Portrait album/ })
  const thumbnail = screen.getByTestId('album-cover-frame')

  expect(gallery).toHaveAttribute('data-mobile-layout', 'columns-2')
  expect(gallery).toHaveClass('mobile-album-grid-2', 'xs:block', 'xs:-mx-3')
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
  expect(screen.getByTestId('album-boxes')).toHaveClass(
    'mobile-album-grid-3'
  )
  expect(window.localStorage.getItem(MOBILE_ALBUM_LAYOUT_KEY)).toBe('columns-3')

  unmount()
  renderAlbums()

  expect(screen.getByRole('button', { name: '3 columns' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('uses a row-major grid class for the four-column layout', async () => {
  const user = userEvent.setup()
  renderAlbums()

  await user.click(screen.getByRole('button', { name: '4 columns' }))

  expect(screen.getByTestId('album-boxes')).toHaveAttribute(
    'data-mobile-layout',
    'columns-4'
  )
  expect(screen.getByTestId('album-boxes')).toHaveClass(
    'mobile-album-grid-4'
  )
})

test('uses a compact horizontal card in list mode', async () => {
  const user = userEvent.setup()
  renderAlbums()

  await user.click(screen.getByRole('button', { name: 'Compact list' }))

  expect(screen.getByTestId('album-boxes')).toHaveClass('mobile-album-list')
  expect(screen.getByRole('link', { name: /Portrait album/ })).toHaveClass(
    'mobile-album-card-list'
  )
})
