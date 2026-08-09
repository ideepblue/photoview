export const MOBILE_ALBUM_LAYOUT_KEY = 'photoview.mobileAlbumLayout'

export type MobileAlbumLayout = 'list' | 'columns-2' | 'columns-3' | 'columns-4'

type AlbumLayoutStorage = Pick<Storage, 'getItem' | 'setItem'>

const DEFAULT_MOBILE_ALBUM_LAYOUT: MobileAlbumLayout = 'columns-2'
const VALID_MOBILE_ALBUM_LAYOUTS: MobileAlbumLayout[] = [
  'list',
  'columns-2',
  'columns-3',
  'columns-4',
]

const browserStorage = (): AlbumLayoutStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch (_error) {
    return undefined
  }
}

export const readMobileAlbumLayout = (
  storage: AlbumLayoutStorage | undefined = browserStorage()
): MobileAlbumLayout => {
  try {
    const storedLayout = storage?.getItem(MOBILE_ALBUM_LAYOUT_KEY)

    return VALID_MOBILE_ALBUM_LAYOUTS.includes(
      storedLayout as MobileAlbumLayout
    )
      ? (storedLayout as MobileAlbumLayout)
      : DEFAULT_MOBILE_ALBUM_LAYOUT
  } catch (_error) {
    return DEFAULT_MOBILE_ALBUM_LAYOUT
  }
}

export const writeMobileAlbumLayout = (
  layout: MobileAlbumLayout,
  storage: AlbumLayoutStorage | undefined = browserStorage()
) => {
  try {
    storage?.setItem(MOBILE_ALBUM_LAYOUT_KEY, layout)
  } catch (_error) {
    // Browsing should continue when storage is disabled or unavailable.
  }
}
