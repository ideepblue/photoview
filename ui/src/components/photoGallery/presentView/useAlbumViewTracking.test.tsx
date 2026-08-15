import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import {
  ALBUM_VIEW_DEDUPE_MS,
  RECORD_ALBUM_VIEW_MUTATION,
  useAlbumViewTracking,
} from './useAlbumViewTracking'

vi.useFakeTimers()

const result = {
  data: {
    recordAlbumView: {
      __typename: 'AlbumViewerState',
      featured: false,
      viewCount: 1,
      lastViewedAt: '2026-08-16T10:00:00Z',
    },
  },
}

type HarnessProps = {
  albumId?: string
  mediaId?: string
  reportedAlbums?: Map<string, number>
}

const Harness = ({
  albumId = 'album-1',
  mediaId = 'media-1',
  reportedAlbums = new Map(),
}: HarnessProps) => {
  const setViewingActive = useAlbumViewTracking({
    albumId,
    mediaId,
    reportedAlbums,
  })

  return (
    <>
      <button onClick={() => setViewingActive(true)}>active</button>
      <button onClick={() => setViewingActive(false)}>inactive</button>
    </>
  )
}

const renderHarness = (mocks: MockedResponse[], props: HarnessProps = {}) =>
  render(
    <MockedProvider addTypename={false} mocks={mocks}>
      <Harness {...props} />
    </MockedProvider>
  )

const flushMutation = async () => {
  await act(async () => {
    await Promise.resolve()
    vi.runOnlyPendingTimers()
    await Promise.resolve()
  })
}

const successfulMock = (
  onResult: () => void,
  mediaId = 'media-1'
): MockedResponse => ({
  request: {
    query: RECORD_ALBUM_VIEW_MUTATION,
    variables: { albumId: 'album-1', mediaId },
  },
  result: () => {
    onResult()
    return result
  },
})

beforeEach(() => {
  vi.setSystemTime(new Date('2026-08-16T10:00:00Z'))
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
})

afterEach(() => {
  vi.clearAllTimers()
})

test('records only after two continuous seconds of actual viewing', async () => {
  const onResult = vi.fn()
  renderHarness([successfulMock(onResult)])

  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(1999)
  })
  expect(onResult).not.toHaveBeenCalled()

  act(() => {
    vi.advanceTimersByTime(1)
  })
  await flushMutation()
  expect(onResult).toHaveBeenCalledTimes(1)
})

test('cancels the interval when viewing stops or the page is hidden', async () => {
  const onResult = vi.fn()
  renderHarness([successfulMock(onResult)])

  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(1500)
  })
  fireEvent.click(screen.getByText('inactive'))
  act(() => {
    vi.advanceTimersByTime(1000)
  })
  expect(onResult).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(1500)
  })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'hidden',
  })
  fireEvent(document, new Event('visibilitychange'))
  act(() => {
    vi.advanceTimersByTime(1000)
  })
  expect(onResult).not.toHaveBeenCalled()

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
  fireEvent(document, new Event('visibilitychange'))
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  await flushMutation()
  expect(onResult).toHaveBeenCalledTimes(1)
})

test('cancels the interval when the displayed media changes', async () => {
  const firstResult = vi.fn()
  const secondResult = vi.fn()
  const mocks = [
    successfulMock(firstResult),
    successfulMock(secondResult, 'media-2'),
  ]
  const view = (mediaId: string) => (
    <MockedProvider addTypename={false} mocks={mocks}>
      <Harness mediaId={mediaId} />
    </MockedProvider>
  )
  const rendered = render(view('media-1'))

  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(1500)
  })
  rendered.rerender(view('media-2'))
  act(() => {
    vi.advanceTimersByTime(1000)
  })
  expect(firstResult).not.toHaveBeenCalled()
  expect(secondResult).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  await flushMutation()
  expect(secondResult).toHaveBeenCalledTimes(1)
})

test('suppresses another report for the same album for 30 minutes', async () => {
  const firstResult = vi.fn()
  const secondResult = vi.fn()
  const reportedAlbums = new Map<string, number>()
  const { unmount } = renderHarness([successfulMock(firstResult)], {
    reportedAlbums,
  })

  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  await flushMutation()
  expect(firstResult).toHaveBeenCalledTimes(1)
  const firstReportedAt = reportedAlbums.get('album-1')
  expect(firstReportedAt).toBeDefined()
  unmount()

  vi.setSystemTime(firstReportedAt! + ALBUM_VIEW_DEDUPE_MS - 2001)
  const second = renderHarness([successfulMock(secondResult)], {
    reportedAlbums,
  })
  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(secondResult).not.toHaveBeenCalled()
  second.unmount()

  vi.setSystemTime(firstReportedAt! + ALBUM_VIEW_DEDUPE_MS - 2000)
  renderHarness([successfulMock(secondResult)], { reportedAlbums })
  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  await flushMutation()
  expect(secondResult).toHaveBeenCalledTimes(1)
})

test('does not block the viewer and retries after a passive tracking failure', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const retryResult = vi.fn()
  const failedMock: MockedResponse = {
    request: {
      query: RECORD_ALBUM_VIEW_MUTATION,
      variables: { albumId: 'album-1', mediaId: 'media-1' },
    },
    error: new Error('offline'),
  }

  renderHarness([failedMock, successfulMock(retryResult)])
  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  await flushMutation()
  expect(warning).toHaveBeenCalled()

  fireEvent.click(screen.getByText('inactive'))
  fireEvent.click(screen.getByText('active'))
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  await flushMutation()
  expect(retryResult).toHaveBeenCalledTimes(1)
  warning.mockRestore()
})
