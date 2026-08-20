import { fireEvent, render, screen } from '@testing-library/react'

import React from 'react'
import { MediaType } from '../../../__generated__/globalTypes'
import { MediaGalleryFields } from '../__generated__/MediaGalleryFields'
import PresentMedia from './PresentMedia'

test('render present image', () => {
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
  const highRes = screen.getByTestId('present-img-highres')

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
    screen.getByRole('status', { name: 'Thumbnail preview is displayed' })
  ).toHaveAttribute('data-quality', 'thumbnail')

  fireEvent.load(highRes)
  expect(
    screen.getByRole('status', {
      name: 'High-resolution resource is displayed',
    })
  ).toHaveAttribute('data-quality', 'high-res')
  expect(onViewingActive).toHaveBeenCalledWith(true)
})

test('marks a high-resolution image as unavailable after a load error', () => {
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

  render(<PresentMedia media={media} />)

  fireEvent.error(screen.getByTestId('present-img-highres'))

  expect(
    screen.getByRole('status', {
      name: 'High-resolution resource is unavailable',
    })
  ).toHaveAttribute('data-quality', 'unavailable')
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
