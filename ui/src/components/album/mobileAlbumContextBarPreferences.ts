import { useCallback, useEffect, useState } from 'react'

export type MobileAlbumContextBarHandedness = 'left' | 'right'

export const MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY =
  'photoview.mobile-album-context-bar.handedness'

const MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_EVENT =
  'photoview-mobile-album-context-bar-handedness-change'

const getStorage = () => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export const readMobileAlbumContextBarHandedness =
  (): MobileAlbumContextBarHandedness => {
    const storedValue = getStorage()?.getItem(
      MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY
    )

    return storedValue === 'left' || storedValue === 'right'
      ? storedValue
      : 'right'
  }

export const writeMobileAlbumContextBarHandedness = (
  handedness: MobileAlbumContextBarHandedness
) => {
  try {
    getStorage()?.setItem(MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY, handedness)
  } catch {
    // The current page still adopts the preference when storage is unavailable.
  }

  if (typeof window !== 'undefined') {
    const event = new window.Event(MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_EVENT)
    Object.assign(event, { handedness })
    window.dispatchEvent(event)
  }
}

export const useMobileAlbumContextBarHandedness = () => {
  const [handedness, setHandedness] = useState<MobileAlbumContextBarHandedness>(
    readMobileAlbumContextBarHandedness
  )

  useEffect(() => {
    const handlePreferenceChange = (event: Event) => {
      setHandedness(
        (event as Event & { handedness: MobileAlbumContextBarHandedness })
          .handedness
      )
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY) {
        setHandedness(readMobileAlbumContextBarHandedness())
      }
    }

    window.addEventListener(
      MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_EVENT,
      handlePreferenceChange
    )
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener(
        MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_EVENT,
        handlePreferenceChange
      )
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const updateHandedness = useCallback(
    (value: MobileAlbumContextBarHandedness) => {
      writeMobileAlbumContextBarHandedness(value)
    },
    []
  )

  return [handedness, updateHandedness] as const
}
