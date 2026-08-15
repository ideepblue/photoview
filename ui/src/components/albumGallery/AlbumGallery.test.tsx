import React from 'react'
import { MockedProvider } from '@apollo/client/testing'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { MediaType } from '../../__generated__/globalTypes'
import { AlbumGalleryFields } from './__generated__/AlbumGalleryFields'
import AlbumGallery from './AlbumGallery'

vi.mock('../photoGallery/photoGalleryMutations', () => ({
  useMarkFavoriteMutation: () => [vi.fn()],
}))

const albumWithSections: AlbumGalleryFields = {
  __typename: 'Album',
  id: 'parent',
  title: 'Parent album',
  viewerState: {
    __typename: 'AlbumViewerState',
    featured: false,
    viewCount: 0,
    lastViewedAt: null,
  },
  subAlbums: [
    {
      __typename: 'Album',
      id: 'child',
      title: 'Child album',
      viewerState: {
        __typename: 'AlbumViewerState',
        featured: false,
        viewCount: 0,
        lastViewedAt: null,
      },
      thumbnail: {
        __typename: 'Media',
        id: 'child-cover',
        thumbnail: {
          __typename: 'MediaURL',
          url: '/child.jpg',
          width: 800,
          height: 1200,
        },
      },
    },
  ],
  media: [
    {
      __typename: 'Media',
      id: 'photo',
      title: 'photo.jpg',
      type: MediaType.Photo,
      blurhash: null,
      thumbnail: {
        __typename: 'MediaURL',
        url: '/photo.jpg',
        width: 800,
        height: 1200,
      },
      highRes: null,
      videoWeb: null,
      favorite: false,
    },
  ],
}

const renderGallery = (album: AlbumGalleryFields) =>
  render(
    <MockedProvider>
      <MemoryRouter>
        <AlbumGallery album={album} />
      </MemoryRouter>
    </MockedProvider>
  )

beforeEach(() => {
  window.localStorage.clear()
})

test('labels nested albums and separates them from photos', () => {
  renderGallery(albumWithSections)

  expect(screen.getByRole('heading', { name: 'Subalbums' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Photos' })).toBeInTheDocument()
  expect(screen.getByText('Child album')).toBeInTheDocument()
})

test('does not add a redundant photos divider without both sections', () => {
  renderGallery({ ...albumWithSections, subAlbums: [] })

  expect(
    screen.queryByRole('heading', { name: 'Subalbums' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Photos' })
  ).not.toBeInTheDocument()
})
