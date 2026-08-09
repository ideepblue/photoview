import {
  MOBILE_ALBUM_LAYOUT_KEY,
  readMobileAlbumLayout,
  writeMobileAlbumLayout,
} from './mobileAlbumLayout'

const memoryStorage = (initialValue: string | null = null) => {
  let value = initialValue

  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue
    }),
  }
}

test('defaults to two columns when no preference has been saved', () => {
  expect(readMobileAlbumLayout(memoryStorage())).toBe('columns-2')
})

test.each(['list', 'columns-2', 'columns-3', 'columns-4'] as const)(
  'reads and writes the valid %s preference',
  layout => {
    const storage = memoryStorage()

    writeMobileAlbumLayout(layout, storage)

    expect(storage.setItem).toHaveBeenCalledWith(
      MOBILE_ALBUM_LAYOUT_KEY,
      layout
    )
    expect(readMobileAlbumLayout(storage)).toBe(layout)
  }
)

test('ignores stale or malformed stored values', () => {
  expect(readMobileAlbumLayout(memoryStorage('columns-9'))).toBe('columns-2')
})

test('falls back safely when browser storage is unavailable', () => {
  const unavailableStorage = {
    getItem: vi.fn(() => {
      throw new Error('storage blocked')
    }),
    setItem: vi.fn(() => {
      throw new Error('storage blocked')
    }),
  }

  expect(readMobileAlbumLayout(unavailableStorage)).toBe('columns-2')
  expect(() =>
    writeMobileAlbumLayout('columns-4', unavailableStorage)
  ).not.toThrow()
})
