import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import simplifiedChinese from '../../extractedTranslations/zh-CN/translation.json'
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

test('renders the one-handed layout preference in Simplified Chinese', async () => {
  const instance = i18next.createInstance()
  await instance.init({
    lng: 'zh-CN',
    fallbackLng: false,
    returnEmptyString: false,
    resources: { 'zh-CN': { translation: simplifiedChinese } },
  })

  render(
    <I18nextProvider i18n={instance}>
      <MobileAlbumContextBarPreference />
    </I18nextProvider>
  )

  expect(screen.getByRole('heading', { name: '单手操作布局' })).toBeVisible()
  expect(screen.getByRole('group', { name: '惯用手' })).toBeVisible()
  expect(screen.getByRole('button', { name: '左手' })).toBeVisible()
  expect(screen.getByRole('button', { name: '右手' })).toBeVisible()
})
