import {
  getPresentViewPreferences,
  PRESENT_VIEW_PREFERENCES_KEY,
  setPresentViewPreferences,
} from './presentViewPreferences'

beforeEach(() => {
  window.localStorage.clear()
})

test('enables position, filename, and high-resolution images by default', () => {
  expect(getPresentViewPreferences()).toEqual({
    showPosition: true,
    showFilename: true,
    loadHighRes: true,
  })
})

test('persists the position and filename switches independently', () => {
  setPresentViewPreferences({
    showPosition: false,
    showFilename: true,
    loadHighRes: false,
  })

  expect(getPresentViewPreferences()).toEqual({
    showPosition: false,
    showFilename: true,
    loadHighRes: false,
  })

  setPresentViewPreferences({
    showPosition: true,
    showFilename: false,
    loadHighRes: true,
  })

  expect(getPresentViewPreferences()).toEqual({
    showPosition: true,
    showFilename: false,
    loadHighRes: true,
  })
})

test('falls back to enabled switches for malformed saved values', () => {
  window.localStorage.setItem(PRESENT_VIEW_PREFERENCES_KEY, '{not-json')

  expect(getPresentViewPreferences()).toEqual({
    showPosition: true,
    showFilename: true,
    loadHighRes: true,
  })

  window.localStorage.setItem(
    PRESENT_VIEW_PREFERENCES_KEY,
    JSON.stringify({
      showPosition: 'no',
      showFilename: null,
      loadHighRes: 'yes',
    })
  )

  expect(getPresentViewPreferences()).toEqual({
    showPosition: true,
    showFilename: true,
    loadHighRes: true,
  })
})

test('falls back safely when browser storage is unavailable', () => {
  const unavailableStorage = {
    getItem: () => {
      throw new Error('storage unavailable')
    },
    setItem: () => {
      throw new Error('storage unavailable')
    },
  }

  expect(getPresentViewPreferences(unavailableStorage)).toEqual({
    showPosition: true,
    showFilename: true,
    loadHighRes: true,
  })

  expect(() =>
    setPresentViewPreferences(
      { showPosition: false, showFilename: false, loadHighRes: false },
      unavailableStorage
    )
  ).not.toThrow()
})
