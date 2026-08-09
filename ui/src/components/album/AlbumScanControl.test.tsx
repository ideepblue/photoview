import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { useIsAdmin } from '../routes/AuthorizedRoute'
import AlbumScanControl, { SCAN_ALBUM_MUTATION } from './AlbumScanControl'
import { SCANNER_COMPLETE_EVENT } from './scannerEvents'

vi.mock('../routes/AuthorizedRoute', () => ({
  useIsAdmin: vi.fn(),
}))

const useIsAdminMock = vi.mocked(useIsAdmin)

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }))
  )
})

const scanMock = (
  recursive: boolean,
  forceRefresh: boolean,
  result: MockedResponse['result'] = {
    data: {
      scanAlbum: {
        __typename: 'ScannerResult',
        success: true,
        message: 'Queued 1 album(s) for scanning',
      },
    },
  }
): MockedResponse => ({
  request: {
    query: SCAN_ALBUM_MUTATION,
    variables: {
      albumId: '42',
      recursive,
      forceRefresh,
    },
  },
  result,
})

const renderControl = (
  mocks: MockedResponse[] = [],
  onScanComplete = vi.fn()
) =>
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <AlbumScanControl albumId="42" onScanComplete={onScanComplete} />
    </MockedProvider>
  )

beforeEach(() => {
  useIsAdminMock.mockReset()
  useIsAdminMock.mockReturnValue(true)
})

test('hides album scan controls from non-administrators', () => {
  useIsAdminMock.mockReturnValue(false)
  renderControl()

  expect(
    screen.queryByRole('button', { name: 'Scan and cache' })
  ).not.toBeInTheDocument()
})

test('defaults to current album without forcing healthy thumbnails', async () => {
  const user = userEvent.setup()
  renderControl([scanMock(false, false)])

  await user.click(screen.getByRole('button', { name: 'Scan and cache' }))
  expect(
    screen.getByRole('radio', { name: 'Current album only' })
  ).toBeChecked()
  expect(
    screen.getByRole('checkbox', {
      name: 'Force rebuild existing thumbnails',
    })
  ).not.toBeChecked()

  await user.click(screen.getByRole('button', { name: 'Start scan' }))
  expect(
    await screen.findByText('Queued 1 album(s) for scanning')
  ).toBeVisible()
})

test('confirms recursive forced refresh before starting it', async () => {
  const user = userEvent.setup()
  renderControl([scanMock(true, true)])

  await user.click(screen.getByRole('button', { name: 'Scan and cache' }))
  await user.click(
    screen.getByRole('radio', {
      name: 'Current album and all child albums',
    })
  )
  await user.click(
    screen.getByRole('checkbox', {
      name: 'Force rebuild existing thumbnails',
    })
  )
  await user.click(screen.getByRole('button', { name: 'Start scan' }))

  expect(
    screen.getByRole('dialog', { name: 'Rebuild thumbnails recursively?' })
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  expect(
    await screen.findByText('Queued 1 album(s) for scanning')
  ).toBeVisible()
})

test('reports mutation errors beside the mobile control', async () => {
  const user = userEvent.setup()
  renderControl([
    {
      ...scanMock(false, false),
      result: undefined,
      error: new Error('request failed'),
    },
  ])

  await user.click(screen.getByRole('button', { name: 'Scan and cache' }))
  await user.click(screen.getByRole('button', { name: 'Start scan' }))

  expect(
    await screen.findByText('Could not start scan: request failed')
  ).toBeVisible()
})

test('refetches the initiating album when the scanner completes', async () => {
  const user = userEvent.setup()
  const onScanComplete = vi.fn().mockResolvedValue(undefined)
  renderControl([scanMock(false, false)], onScanComplete)

  await user.click(screen.getByRole('button', { name: 'Scan and cache' }))
  await user.click(screen.getByRole('button', { name: 'Start scan' }))
  await screen.findByText('Queued 1 album(s) for scanning')

  window.dispatchEvent(new Event(SCANNER_COMPLETE_EVENT))

  await waitFor(() => expect(onScanComplete).toHaveBeenCalledTimes(1))
  expect(
    await screen.findByText('Scan complete. Album refreshed.')
  ).toBeVisible()
})
