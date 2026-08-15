import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import AlbumFeaturedButton, {
  SET_ALBUM_FEATURED_MUTATION,
} from './AlbumFeaturedButton'

const featuredResult = {
  __typename: 'AlbumViewerState',
  featured: true,
  viewCount: 4,
  lastViewedAt: '2026-08-16T12:00:00Z',
}

const renderButton = (mock: MockedResponse) =>
  render(
    <MockedProvider addTypename={false} mocks={[mock]}>
      <AlbumFeaturedButton
        albumId="album-1"
        featured={false}
        viewCount={4}
        lastViewedAt="2026-08-16T12:00:00Z"
      />
    </MockedProvider>
  )

test('optimistically toggles personal curation with a 44px touch target', async () => {
  const user = userEvent.setup()
  renderButton({
    request: {
      query: SET_ALBUM_FEATURED_MUTATION,
      variables: { albumId: 'album-1', featured: true },
    },
    result: { data: { setAlbumFeatured: featuredResult } },
    delay: 50,
  })

  const button = screen.getByRole('button', {
    name: 'Add album to featured',
  })
  expect(button).toHaveClass('h-11', 'w-11')

  await user.click(button)

  expect(
    screen.getByRole('button', { name: 'Remove album from featured' })
  ).toHaveAttribute('aria-pressed', 'true')

  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Remove album from featured' })
    ).not.toBeDisabled()
  )
})

test('rolls back and shows a concise non-blocking error when curation fails', async () => {
  const user = userEvent.setup()
  renderButton({
    request: {
      query: SET_ALBUM_FEATURED_MUTATION,
      variables: { albumId: 'album-1', featured: true },
    },
    error: new Error('offline'),
  })

  await user.click(
    screen.getByRole('button', { name: 'Add album to featured' })
  )

  expect(
    await screen.findByRole('alert', {
      name: 'Could not update featured album',
    })
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Add album to featured' })
  ).toHaveAttribute('aria-pressed', 'false')
})
