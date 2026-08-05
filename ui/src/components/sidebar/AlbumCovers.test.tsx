import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MockedProvider } from '@apollo/client/testing'

import { SET_ALBUM_COVER_MUTATION, SidebarPhotoCover } from './AlbumCovers'
import * as authentication from '../../helpers/authentication'

vi.mock('../../helpers/authentication.ts')

const authToken = vi.mocked(authentication.authToken)

test('sets the selected photo as its parent album cover', async () => {
  authToken.mockReturnValue('token-here')
  const user = userEvent.setup()
  const mocks = [
    {
      request: {
        query: SET_ALBUM_COVER_MUTATION,
        variables: { coverID: '6867', albumID: '2200' },
      },
      result: {
        data: {
          setAlbumCover: {
            __typename: 'Album',
            id: '2200',
            thumbnail: {
              __typename: 'Media',
              id: '6867',
              thumbnail: {
                __typename: 'MediaURL',
                url: '/photo/thumbnail.jpg',
              },
            },
          },
        },
      },
    },
  ]

  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <SidebarPhotoCover
        cover_id="6867"
        album={{
          id: '2294',
          title: 'album_name',
          path: [{ id: '2200', title: 'model_name' }],
        }}
      />
    </MockedProvider>
  )

  await user.click(
    screen.getByRole('button', {
      name: 'Set as cover for parent album “model_name”',
    })
  )

  expect(
    await screen.findByText('Cover set for “model_name”')
  ).toBeInTheDocument()
})
