export const PRESENT_VIEW_PREFERENCES_KEY = 'photoview.present-view.preferences'

export type PresentViewPreferences = {
  showPosition: boolean
  showFilename: boolean
}

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

const DEFAULT_PREFERENCES: PresentViewPreferences = {
  showPosition: true,
  showFilename: true,
}

const resolveStorage = (storage?: PreferenceStorage) => {
  if (storage) return storage
  return typeof window === 'undefined' ? undefined : window.localStorage
}

export const getPresentViewPreferences = (
  storage?: PreferenceStorage
): PresentViewPreferences => {
  try {
    const saved = resolveStorage(storage)?.getItem(PRESENT_VIEW_PREFERENCES_KEY)
    if (!saved) return { ...DEFAULT_PREFERENCES }

    const parsed = JSON.parse(saved) as Partial<PresentViewPreferences>
    if (
      typeof parsed.showPosition !== 'boolean' ||
      typeof parsed.showFilename !== 'boolean'
    ) {
      return { ...DEFAULT_PREFERENCES }
    }

    return {
      showPosition: parsed.showPosition,
      showFilename: parsed.showFilename,
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export const setPresentViewPreferences = (
  preferences: PresentViewPreferences,
  storage?: PreferenceStorage
) => {
  try {
    resolveStorage(storage)?.setItem(
      PRESENT_VIEW_PREFERENCES_KEY,
      JSON.stringify(preferences)
    )
  } catch {
    // Keep the in-memory viewer state usable when storage is blocked.
  }
}
