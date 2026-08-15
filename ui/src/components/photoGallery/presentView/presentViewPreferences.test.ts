import {
  getPresentViewPreferences,
  PRESENT_VIEW_PREFERENCES_KEY,
  setPresentViewPreferences,
} from './presentViewPreferences'

beforeEach(() => {
  window.localStorage.clear()
})

test('enables position and filename when no preference has been saved', () => {
  expect(getPresentViewPreferences()).toEqual({
    showPosition: true,
    showFilename: true,
  })
})

test('persists the position and filename switches independently', () => {
  setPresentViewPreferences({
    showPosition: false,
    showFilename: true,
  })

  expect(getPresentViewPreferences()).toEqual({
    showPosition: false,
    showFilename: true,
  })

  setPresentViewPreferences({
    showPosition: true,
    showFilename: false,
  })

  expect(getPresentViewPreferences()).toEqual({
    showPosition: true,
    showFilename: false,
  })
})

test('falls back to enabled switches for malformed saved values', () => {
  window.localStorage.setItem(PRESENT_VIEW_PREFERENCES_KEY, '{not-json')

  expect(getPresentViewPreferences()).toEqual({
    showPosition: true,
    showFilename: true,
  })

  window.localStorage.setItem(
    PRESENT_VIEW_PREFERENCES_KEY,
    JSON.stringify({ showPosition: 'no', showFilename: null })
  )

  expect(getPresentViewPreferences()).toEqual({
    showPosition: true,
    showFilename: true,
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
  })

  expect(() =>
    setPresentViewPreferences(
      { showPosition: false, showFilename: false },
      unavailableStorage
    )
  ).not.toThrow()
})
