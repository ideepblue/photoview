import {
  ALBUM_LIST_RETURN_CONTEXT_STORAGE_KEY,
  albumListPresentationKey,
  getAlbumListReturnRecord,
  getAlbumListReturnTarget,
  mergeAlbumListReturnTarget,
  saveAlbumListReturnRecord,
} from './albumListReturnContext'

beforeEach(() => {
  window.localStorage.clear()
})

test('keeps the last opened marker independent for every parent list', () => {
  saveAlbumListReturnRecord({
    parentListKey: '/albums',
    presentationKey: albumListPresentationKey('/albums', '', 'columns-2'),
    albumId: 'root-child',
    albumTitle: 'Root child',
    scrollY: 120,
    cardViewportOffset: 64,
    updatedAt: 100,
  })
  saveAlbumListReturnRecord({
    parentListKey: '/album/parent',
    presentationKey: albumListPresentationKey(
      '/album/parent',
      '?albumOrderBy=view_count',
      'list'
    ),
    albumId: 'nested-child',
    albumTitle: 'Nested child',
    scrollY: 240,
    cardViewportOffset: 72,
    updatedAt: 200,
  })
  saveAlbumListReturnRecord({
    parentListKey: '/albums',
    presentationKey: albumListPresentationKey('/albums', '', 'columns-2'),
    albumId: 'new-root-child',
    albumTitle: 'New root child',
    scrollY: 300,
    cardViewportOffset: 84,
    updatedAt: 300,
  })

  expect(getAlbumListReturnRecord('/albums')?.albumId).toBe('new-root-child')
  expect(getAlbumListReturnRecord('/album/parent')?.albumId).toBe(
    'nested-child'
  )
})

test('isolates restoration positions by canonical query and mobile layout', () => {
  expect(
    albumListPresentationKey(
      '/album/parent',
      '?albumOrderDirection=DESC&albumOrderBy=view_count',
      'columns-2'
    )
  ).toBe(
    albumListPresentationKey(
      '/album/parent',
      '?albumOrderBy=view_count&albumOrderDirection=DESC',
      'columns-2'
    )
  )
  expect(
    albumListPresentationKey(
      '/album/parent',
      '?albumOrderBy=view_count',
      'columns-2'
    )
  ).not.toBe(
    albumListPresentationKey('/album/parent', '?albumOrderBy=title', 'list')
  )
})

test('retains a parent marker even when its saved presentation changes', () => {
  saveAlbumListReturnRecord({
    parentListKey: '/album/parent',
    presentationKey: albumListPresentationKey('/album/parent', '', 'list'),
    albumId: 'child',
    albumTitle: 'Child',
    scrollY: 30,
    cardViewportOffset: 50,
    updatedAt: 100,
  })

  expect(getAlbumListReturnRecord('/album/parent')).toMatchObject({
    albumId: 'child',
    presentationKey: albumListPresentationKey('/album/parent', '', 'list'),
  })
})

test('recovers safely from malformed local storage data', () => {
  window.localStorage.setItem(ALBUM_LIST_RETURN_CONTEXT_STORAGE_KEY, '{oops')

  expect(getAlbumListReturnRecord('/albums')).toBeUndefined()

  window.localStorage.setItem(
    ALBUM_LIST_RETURN_CONTEXT_STORAGE_KEY,
    JSON.stringify({
      '/albums': { parentListKey: '/albums', albumId: 1 },
    })
  )

  expect(getAlbumListReturnRecord('/albums')).toBeUndefined()
})

test('replaces a duplicate parent target while preserving ancestors', () => {
  const rootState = mergeAlbumListReturnTarget(undefined, {
    parentListKey: '/albums',
    to: '/albums?albumOrderBy=title',
  })
  const nestedState = mergeAlbumListReturnTarget(rootState, {
    parentListKey: '/album/parent',
    to: '/album/parent?viewed=viewed',
  })
  const updatedRootState = mergeAlbumListReturnTarget(nestedState, {
    parentListKey: '/albums',
    to: '/albums?albumOrderBy=view_count',
  })

  expect(getAlbumListReturnTarget(updatedRootState, '/albums')).toEqual({
    parentListKey: '/albums',
    to: '/albums?albumOrderBy=view_count',
  })
  expect(getAlbumListReturnTarget(updatedRootState, '/album/parent')).toEqual({
    parentListKey: '/album/parent',
    to: '/album/parent?viewed=viewed',
  })
})
