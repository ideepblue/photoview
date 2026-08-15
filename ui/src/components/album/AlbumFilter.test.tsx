import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { OrderDirection } from '../../__generated__/globalTypes'
import * as authentication from '../../helpers/authentication'
import AlbumFilter from './AlbumFilter'

vi.mock('../../helpers/authentication.ts')

const authToken = vi.mocked(authentication.authToken)

beforeEach(() => {
  authToken.mockReturnValue('token')
})

test('offers independent quick filters for viewed state and personal curation', async () => {
  const user = userEvent.setup()
  const setViewStatus = vi.fn()
  const setOnlyFeatured = vi.fn()
  const setOrdering = vi.fn()

  render(
    <AlbumFilter
      onlyFavorites={false}
      albumEngagement={{
        viewStatus: 'all',
        setViewStatus,
        onlyFeatured: false,
        setOnlyFeatured,
        ordering: {
          orderBy: 'title',
          orderDirection: OrderDirection.ASC,
        },
        setOrdering,
      }}
    />
  )

  expect(screen.getByRole('group', { name: 'Album view status' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'All albums' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )

  await user.click(screen.getByRole('button', { name: 'Viewed albums' }))
  expect(setViewStatus).toHaveBeenCalledWith('viewed')

  await user.click(screen.getByRole('button', { name: 'Unviewed albums' }))
  expect(setViewStatus).toHaveBeenCalledWith('unviewed')

  await user.click(screen.getByRole('checkbox', { name: 'Featured albums only' }))
  expect(setOnlyFeatured).toHaveBeenCalledWith(true)

  const albumSort = screen.getByRole('combobox', { name: 'Album sort' })
  expect(albumSort).toHaveValue('title')
  expect(albumSort).toHaveTextContent('View count')
  expect(albumSort).toHaveTextContent('Recently viewed')

  fireEvent.change(albumSort, { target: { value: 'view_count' } })
  expect(setOrdering).toHaveBeenCalledWith({ orderBy: 'view_count' })
})
