import { gql } from '@apollo/client'
import { MockedProvider } from '@apollo/client/testing'
import { render, screen } from '@testing-library/react'
import React from 'react'
import AlbumSidebar from './AlbumSidebar'

vi.mock('./Sharing', () => ({ SidebarAlbumShare: () => null }))
vi.mock('./AlbumCovers', () => ({ SidebarAlbumCover: () => null }))
vi.mock('./SidebarDownloadAlbum', () => ({ default: () => null }))

const ALBUM_QUERY = gql`
  query getAlbumSidebar($id: ID!) {
    album(id: $id) {
      id
      title
    }
  }
`

test('includes the one-handed album bar preference in album options', async () => {
  render(
    <MockedProvider
      addTypename={false}
      mocks={[
        {
          request: { query: ALBUM_QUERY, variables: { id: '3' } },
          result: {
            data: { album: { id: '3', title: 'Child album' } },
          },
        },
      ]}
    >
      <AlbumSidebar albumId="3" />
    </MockedProvider>
  )

  expect(
    await screen.findByRole('heading', { name: 'One-handed album bar' })
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Left hand' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Right hand' })).toBeVisible()
})
