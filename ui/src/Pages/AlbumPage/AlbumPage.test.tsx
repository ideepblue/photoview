import { MockedProvider } from '@apollo/client/testing'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AlbumPage from './AlbumPage'

vi.mock('../../hooks/useScrollPagination')

test('AlbumPage defaults to title in ascending order', () => {
  render(
    <MockedProvider mocks={[]}>
      <MemoryRouter initialEntries={['/album/1']}>
        <Routes>
          <Route path="/album/:id" element={<AlbumPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>
  )

  expect(screen.getByText('Sort')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveValue('title')
  expect(screen.getByLabelText('Sort direction')).toHaveTextContent('Ascending')
  expect(
    screen.getByText('Sort').closest('.mobile-album-context-bar-clearance')
  ).not.toBeNull()

  screen.debug()
})
