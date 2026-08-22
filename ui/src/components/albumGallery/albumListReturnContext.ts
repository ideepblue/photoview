import { MobileAlbumLayout } from './mobileAlbumLayout'

export const ALBUM_LIST_RETURN_CONTEXT_STORAGE_KEY =
  'photoview.albumListReturnContext.v1'

const ALBUM_LIST_RETURN_STATE_KEY = 'albumListReturnContext'

export type AlbumListReturnRecord = {
  parentListKey: string
  presentationKey: string
  albumId: string
  albumTitle: string
  scrollY: number
  cardViewportOffset: number
  updatedAt: number
}

export type AlbumListReturnTarget = {
  parentListKey: string
  to: string
}

type AlbumListReturnState = {
  targets: AlbumListReturnTarget[]
  restore?: boolean
}

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>

const browserStorage = (): BrowserStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch (_error) {
    return undefined
  }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isAlbumListReturnRecord = (
  value: unknown
): value is AlbumListReturnRecord => {
  if (!value || typeof value !== 'object') return false

  const record = value as Partial<AlbumListReturnRecord>
  return (
    typeof record.parentListKey === 'string' &&
    typeof record.presentationKey === 'string' &&
    typeof record.albumId === 'string' &&
    typeof record.albumTitle === 'string' &&
    isFiniteNumber(record.scrollY) &&
    record.scrollY >= 0 &&
    isFiniteNumber(record.cardViewportOffset) &&
    isFiniteNumber(record.updatedAt)
  )
}

const readAlbumListReturnRecords = (
  storage: BrowserStorage | undefined = browserStorage()
): Record<string, AlbumListReturnRecord> => {
  try {
    const value = storage?.getItem(ALBUM_LIST_RETURN_CONTEXT_STORAGE_KEY)
    if (!value) return {}

    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const recordMap = parsed as Record<string, unknown>
    return Object.entries(recordMap).reduce<
      Record<string, AlbumListReturnRecord>
    >((records, [parentListKey, record]) => {
      if (
        isAlbumListReturnRecord(record) &&
        record.parentListKey === parentListKey
      ) {
        records[parentListKey] = record
      }
      return records
    }, {})
  } catch (_error) {
    return {}
  }
}

export const getAlbumListReturnRecord = (
  parentListKey: string,
  storage: BrowserStorage | undefined = browserStorage()
) => readAlbumListReturnRecords(storage)[parentListKey]

export const saveAlbumListReturnRecord = (
  record: AlbumListReturnRecord,
  storage: BrowserStorage | undefined = browserStorage()
) => {
  if (!isAlbumListReturnRecord(record)) return

  try {
    const records = readAlbumListReturnRecords(storage)
    records[record.parentListKey] = record
    storage?.setItem(
      ALBUM_LIST_RETURN_CONTEXT_STORAGE_KEY,
      JSON.stringify(records)
    )
  } catch (_error) {
    // Browsing should continue when browser storage is disabled or unavailable.
  }
}

const canonicalSearch = (search: string) => {
  const entries = Array.from(new URLSearchParams(search).entries()).sort(
    ([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyComparison = leftKey.localeCompare(rightKey)
      return keyComparison === 0
        ? leftValue.localeCompare(rightValue)
        : keyComparison
    }
  )
  const params = new URLSearchParams(entries)
  const normalized = params.toString()
  return normalized ? `?${normalized}` : ''
}

export const albumListPresentationKey = (
  parentListKey: string,
  search: string,
  layout: MobileAlbumLayout
) => `${parentListKey}${canonicalSearch(search)}#${layout}`

export const albumListParentKey = (pathname: string): string | undefined => {
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/'
  if (normalizedPathname === '/albums') return normalizedPathname
  return /^\/album\/[^/]+$/.test(normalizedPathname)
    ? normalizedPathname
    : undefined
}

const readAlbumListReturnState = (
  state: unknown
): AlbumListReturnState | undefined => {
  if (!state || typeof state !== 'object' || Array.isArray(state))
    return undefined

  const value = (state as Record<string, unknown>)[ALBUM_LIST_RETURN_STATE_KEY]
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined

  const candidate = value as Partial<AlbumListReturnState>
  if (!Array.isArray(candidate.targets)) return undefined

  const targets = candidate.targets.filter(
    (target): target is AlbumListReturnTarget =>
      !!target &&
      typeof target === 'object' &&
      typeof target.parentListKey === 'string' &&
      typeof target.to === 'string' &&
      target.to.startsWith('/')
  )

  if (targets.length !== candidate.targets.length) return undefined

  return {
    targets,
    restore: candidate.restore === true,
  }
}

const stateObject = (state: unknown): Record<string, unknown> =>
  state && typeof state === 'object' && !Array.isArray(state)
    ? (state as Record<string, unknown>)
    : {}

export const mergeAlbumListReturnTarget = (
  state: unknown,
  target: AlbumListReturnTarget
) => {
  const previous = readAlbumListReturnState(state)
  const targets = (previous?.targets || []).filter(
    existing => existing.parentListKey !== target.parentListKey
  )

  return {
    ...stateObject(state),
    [ALBUM_LIST_RETURN_STATE_KEY]: {
      targets: [...targets, target],
    },
  }
}

export const getAlbumListReturnTarget = (
  state: unknown,
  parentListKey: string
) =>
  readAlbumListReturnState(state)?.targets.find(
    target => target.parentListKey === parentListKey
  )

export const withAlbumListRestoreIntent = (state: unknown) => {
  const previous = readAlbumListReturnState(state)
  return {
    ...stateObject(state),
    [ALBUM_LIST_RETURN_STATE_KEY]: {
      targets: previous?.targets || [],
      restore: true,
    },
  }
}

export const hasAlbumListRestoreIntent = (state: unknown) =>
  readAlbumListReturnState(state)?.restore === true
