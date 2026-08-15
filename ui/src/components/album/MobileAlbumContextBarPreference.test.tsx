import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import MobileAlbumContextBarPreference from './MobileAlbumContextBarPreference'
import { MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY } from './mobileAlbumContextBarPreferences'

beforeEach(() => {
  window.localStorage.clear()
})

test('switches the one-handed album bar from the default right side to the left', () => {
  render(<MobileAlbumContextBarPreference />)

  const rightHand = screen.getByRole('button', { name: 'Right hand' })
  const leftHand = screen.getByRole('button', { name: 'Left hand' })

  expect(rightHand).toHaveAttribute('aria-pressed', 'true')
  expect(leftHand).toHaveAttribute('aria-pressed', 'false')

  fireEvent.click(leftHand)

  expect(leftHand).toHaveAttribute('aria-pressed', 'true')
  expect(rightHand).toHaveAttribute('aria-pressed', 'false')
  expect(
    window.localStorage.getItem(MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY)
  ).toBe('left')
})
