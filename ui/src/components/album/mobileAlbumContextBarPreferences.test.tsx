import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import {
  MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY,
  readMobileAlbumContextBarHandedness,
  useMobileAlbumContextBarHandedness,
  writeMobileAlbumContextBarHandedness,
} from './mobileAlbumContextBarPreferences'

beforeEach(() => {
  window.localStorage.clear()
})

test('defaults to the right-hand layout when no valid preference exists', () => {
  expect(readMobileAlbumContextBarHandedness()).toBe('right')

  window.localStorage.setItem(
    MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY,
    'ambidextrous'
  )

  expect(readMobileAlbumContextBarHandedness()).toBe('right')
})

test('persists a left-hand preference', () => {
  writeMobileAlbumContextBarHandedness('left')

  expect(
    window.localStorage.getItem(MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY)
  ).toBe('left')
  expect(readMobileAlbumContextBarHandedness()).toBe('left')
})

const PreferenceProbe = ({ name }: { name: string }) => {
  const [handedness, setHandedness] = useMobileAlbumContextBarHandedness()

  return (
    <button onClick={() => setHandedness('left')}>
      {name}: {handedness}
    </button>
  )
}

test('updates every mounted consumer immediately in the same tab', () => {
  render(
    <>
      <PreferenceProbe name="first" />
      <PreferenceProbe name="second" />
    </>
  )

  fireEvent.click(screen.getByRole('button', { name: 'first: right' }))

  expect(screen.getByRole('button', { name: 'first: left' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'second: left' })).toBeVisible()
})
