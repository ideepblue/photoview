import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { OrderDirection } from '../__generated__/globalTypes'
import useAlbumEngagementParams from './useAlbumEngagementParams'
import useURLParameters from './useURLParameters'

const Harness = () => {
  const urlParams = useURLParameters()
  const params = useAlbumEngagementParams(urlParams)

  return (
    <div>
      <output aria-label="view status">{params.viewStatus}</output>
      <output aria-label="featured">{String(params.onlyFeatured)}</output>
      <output aria-label="album order">{params.ordering.orderBy}</output>
      <output aria-label="album direction">
        {params.ordering.orderDirection}
      </output>
      <button onClick={() => params.setViewStatus('unviewed')}>
        Show unviewed
      </button>
      <button onClick={() => params.setOnlyFeatured(false)}>
        Show all curation
      </button>
      <button
        onClick={() =>
          params.setOrdering({
            orderBy: 'last_viewed_at',
            orderDirection: OrderDirection.ASC,
          })
        }
      >
        Oldest viewed
      </button>
    </div>
  )
}

beforeEach(() => {
  history.replaceState({}, '', '/album/1')
})

test('reads album engagement controls from independent URL parameters', () => {
  history.replaceState(
    {},
    '',
    '/album/1?viewed=viewed&featured=1&albumOrderBy=view_count&albumOrderDirection=DESC&orderBy=date_shot'
  )

  render(<Harness />)

  expect(screen.getByLabelText('view status')).toHaveTextContent('viewed')
  expect(screen.getByLabelText('featured')).toHaveTextContent('true')
  expect(screen.getByLabelText('album order')).toHaveTextContent('view_count')
  expect(screen.getByLabelText('album direction')).toHaveTextContent('DESC')
})

test('writes combined album controls without changing the media sort', async () => {
  const user = userEvent.setup()
  history.replaceState({}, '', '/album/1?featured=1&orderBy=date_shot')
  render(<Harness />)

  await user.click(screen.getByRole('button', { name: 'Show unviewed' }))
  await user.click(screen.getByRole('button', { name: 'Show all curation' }))
  await user.click(screen.getByRole('button', { name: 'Oldest viewed' }))

  const params = new URLSearchParams(location.search)
  expect(params.get('viewed')).toBe('unviewed')
  expect(params.has('featured')).toBe(false)
  expect(params.get('albumOrderBy')).toBe('last_viewed_at')
  expect(params.get('albumOrderDirection')).toBe('ASC')
  expect(params.get('orderBy')).toBe('date_shot')
})

test('falls back to safe defaults for invalid URL values', () => {
  history.replaceState(
    {},
    '',
    '/album/1?viewed=everything&albumOrderBy=drop-table&albumOrderDirection=SIDEWAYS'
  )

  render(<Harness />)

  expect(screen.getByLabelText('view status')).toHaveTextContent('all')
  expect(screen.getByLabelText('featured')).toHaveTextContent('false')
  expect(screen.getByLabelText('album order')).toHaveTextContent('title')
  expect(screen.getByLabelText('album direction')).toHaveTextContent('ASC')
})
