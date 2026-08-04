import { MockedProvider } from '@apollo/client/testing'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import AlbumTitle from './AlbumTitle'

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
