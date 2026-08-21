import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import React from 'react'
import { MediaType } from '../../../__generated__/globalTypes'
import { MediaGalleryFields } from '../__generated__/MediaGalleryFields'
import PresentMedia from './PresentMedia'

const successfulHighResResponse = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: {
      'content-type': 'image/jpeg',
      'content-length': '3',
    },
  })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successfulHighResResponse()))
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:high-res-image'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('renders the streamed high-resolution image once its decoded', async () => {
  const onViewingActive = vi.fn()
  const media: MediaGalleryFields = {
    __typename: 'Media',
    id: '123',
    title: 'sample_image.jpg',
    type: MediaType.Photo,
    highRes: {
      __typename: 'MediaURL',
      url: '/sample_image_highres.jpg',
      width: 2400,
      height: 1600,
    },
    blurhash: null,
    videoWeb: null,
    favorite: false,
    thumbnail: {
      __typename: 'MediaURL',
      url: '/sample_image.jpg',
      width: 300,
      height: 200,
    },
  }

  render(<PresentMedia media={media} onViewingActive={onViewingActive} />)

  const thumbnail = screen.getByTestId('present-img-thumbnail')
  const highRes = await screen.findByTestId('present-img-highres')

  expect(thumbnail).toHaveAttribute(
    'src',
    'http://localhost:3000/sample_image.jpg'
  )
  expect(thumbnail).toHaveAttribute('draggable', 'false')
  expect(highRes).toHaveAttribute('draggable', 'false')
  expect(highRes).toHaveStyle({
    display: 'none',
  })
  expect(
    screen.getByRole('status', {
      name: 'High-resolution image loading (100%)',
    })
  ).toHaveAttribute('data-quality', 'thumbnail')

  fireEvent.load(thumbnail)
  fireEvent.load(highRes)
  expect(
    screen.getByRole('status', {
      name: 'High-resolution resource is displayed',
    })
  ).toHaveAttribute('data-quality', 'high-res')
  expect(onViewingActive).toHaveBeenCalledWith(true)
})

test('marks a high-resolution image as unavailable after a failed request and retries on tap', async () => {
  const media: MediaGalleryFields = {
    __typename: 'Media',
    id: 'failed-highres',
    title: 'failed_highres.jpg',
    type: MediaType.Photo,
    highRes: {
      __typename: 'MediaURL',
      url: '/failed_highres.jpg',
      width: 2400,
      height: 1600,
    },
    blurhash: null,
    videoWeb: null,
    favorite: false,
    thumbnail: {
      __typename: 'MediaURL',
      url: '/failed_thumbnail.jpg',
      width: 300,
      height: 200,
    },
  }

  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error('network error'))
    .mockResolvedValueOnce(successfulHighResResponse())
  vi.stubGlobal('fetch', fetchMock)

  render(<PresentMedia media={media} />)

  const unavailable = await screen.findByRole('status', {
    name: 'High-resolution resource is unavailable',
  })

  expect(unavailable).toHaveAttribute('data-quality', 'unavailable')

  fireEvent.click(unavailable)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(await screen.findByTestId('present-img-highres')).toHaveAttribute(
    'src',
    'blob:high-res-image'
  )
})

test('keeps the thumbnail and marks high-resolution loading as disabled by preference', () => {
  const media: MediaGalleryFields = {
    __typename: 'Media',
    id: 'thumbnail-only',
    title: 'thumbnail_only.jpg',
    type: MediaType.Photo,
    highRes: {
      __typename: 'MediaURL',
      url: '/thumbnail_only_highres.jpg',
      width: 2400,
      height: 1600,
    },
    blurhash: null,
    videoWeb: null,
    favorite: false,
    thumbnail: {
      __typename: 'MediaURL',
      url: '/thumbnail_only.jpg',
      width: 300,
      height: 200,
    },
  }

  render(<PresentMedia media={media} loadHighRes={false} />)

  expect(screen.queryByTestId('present-img-highres')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
  expect(
    screen.getByRole('status', {
      name: 'High-resolution loading is disabled',
    })
  ).toHaveAttribute('data-quality', 'high-res-disabled')
})

test('cancels an in-flight high-resolution request when the preference is switched off', () => {
  const media: MediaGalleryFields = {
    __typename: 'Media',
    id: 'cancel-highres',
    title: 'cancel_highres.jpg',
    type: MediaType.Photo,
    highRes: {
      __typename: 'MediaURL',
      url: '/cancel_highres.jpg',
      width: 2400,
      height: 1600,
    },
    blurhash: null,
    videoWeb: null,
    favorite: false,
    thumbnail: {
      __typename: 'MediaURL',
      url: '/cancel_thumbnail.jpg',
      width: 300,
      height: 200,
    },
  }
  const fetchMock = vi.fn(() => new Promise<Response>(() => undefined))
  vi.stubGlobal('fetch', fetchMock)

  const { rerender } = render(<PresentMedia media={media} />)
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal

  rerender(<PresentMedia media={media} loadHighRes={false} />)

  expect(signal.aborted).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('render present video', () => {
  const onViewingActive = vi.fn()
  const media: MediaGalleryFields = {
    __typename: 'Media',
    id: '123',
    title: 'sample_video.mp4',
    type: MediaType.Video,
    highRes: null,
    blurhash: null,
    favorite: false,
    videoWeb: {
      __typename: 'MediaURL',
      url: '/sample_video.mp4',
    },
    thumbnail: {
      __typename: 'MediaURL',
      url: '/sample_video_thumb.jpg',
      width: 300,
      height: 200,
    },
  }

  render(<PresentMedia media={media} onViewingActive={onViewingActive} />)

  expect(screen.getByTestId('present-video')).toHaveAttribute(
    'poster',
    'http://localhost:3000/sample_video_thumb.jpg'
  )

  expect(
    screen.getByTestId('present-video').querySelector('source')
  ).toHaveAttribute('src', 'http://localhost:3000/sample_video.mp4')

  const video = screen.getByTestId('present-video')
  fireEvent.playing(video)
  expect(onViewingActive).toHaveBeenLastCalledWith(true)

  fireEvent.waiting(video)
  expect(onViewingActive).toHaveBeenLastCalledWith(false)
  fireEvent.playing(video)
  fireEvent.pause(video)
  expect(onViewingActive).toHaveBeenLastCalledWith(false)
  fireEvent.playing(video)
  fireEvent.ended(video)
  expect(onViewingActive).toHaveBeenLastCalledWith(false)
})
