import { MockedProvider } from '@apollo/client/testing'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import * as authentication from '../../helpers/authentication'
import AlbumTitle, { ALBUM_PATH_QUERY } from './AlbumTitle'

vi.mock('../../helpers/authentication.ts')

const authToken = vi.mocked(authentication.authToken)

beforeEach(() => {
  authToken.mockReset()
})

test('allows the album header to grow when breadcrumb text wraps', () => {
  render(
    <MemoryRouter>
      <MockedProvider mocks={[]}>
        <AlbumTitle
          album={{ id: '3', title: 'A very long album title' }}
          disableLink={false}
        />
      </MockedProvider>
    </MemoryRouter>
  )

  const albumHeader = screen.getByRole('heading').parentElement?.parentElement

  expect(albumHeader).toHaveClass('min-h-[3.5rem]')
  expect(albumHeader).not.toHaveClass('h-14')
})

test('links back to the immediate parent album', async () => {
  authToken.mockReturnValue('token-here')

  render(
    <MemoryRouter>
      <MockedProvider
        addTypename={false}
        mocks={[
          {
            request: {
              query: ALBUM_PATH_QUERY,
              variables: { id: '3' },
            },
            result: {
              data: {
                album: {
                  id: '3',
                  path: [
                    { id: '2', title: 'Immediate parent' },
                    { id: '1', title: 'Root album' },
                  ],
                },
              },
            },
          },
        ]}
      >
        <AlbumTitle album={{ id: '3', title: 'Child' }} disableLink={true} />
      </MockedProvider>
    </MemoryRouter>
  )

  expect(
    await screen.findByRole('link', { name: 'Back to parent album' })
  ).toHaveAttribute('href', '/album/2')
})

test('links a root album back to the albums page', async () => {
  authToken.mockReturnValue('token-here')

  render(
    <MemoryRouter>
      <MockedProvider
        addTypename={false}
        mocks={[
          {
            request: {
              query: ALBUM_PATH_QUERY,
              variables: { id: '3' },
            },
            result: {
              data: {
                album: {
                  id: '3',
                  path: [],
                },
              },
            },
          },
        ]}
      >
        <AlbumTitle album={{ id: '3', title: 'Root' }} disableLink={true} />
      </MockedProvider>
    </MemoryRouter>
  )

  expect(
    await screen.findByRole('link', { name: 'Back to albums' })
  ).toHaveAttribute('href', '/albums')
})
