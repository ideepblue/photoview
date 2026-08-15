import { useCallback } from 'react'
import { OrderDirection } from '../__generated__/globalTypes'
import { SetOrderingFn } from './useOrderingParams'
import { UrlKeyValuePair, UrlParams } from './useURLParameters'

export type AlbumViewStatus = 'all' | 'viewed' | 'unviewed'
export type AlbumOrderBy =
  | 'title'
  | 'updated_at'
  | 'view_count'
  | 'last_viewed_at'

const VIEW_STATUSES: AlbumViewStatus[] = ['all', 'viewed', 'unviewed']
const ALBUM_ORDER_KEYS: AlbumOrderBy[] = [
  'title',
  'updated_at',
  'view_count',
  'last_viewed_at',
]

const useAlbumEngagementParams = ({
  getParam,
  setParam,
  setParams,
}: UrlParams) => {
  const rawViewStatus = getParam('viewed', 'all')
  const viewStatus = VIEW_STATUSES.includes(rawViewStatus as AlbumViewStatus)
    ? (rawViewStatus as AlbumViewStatus)
    : 'all'
  const onlyFeatured = getParam('featured') === '1'

  const rawOrderBy = getParam('albumOrderBy', 'title')
  const orderBy = ALBUM_ORDER_KEYS.includes(rawOrderBy as AlbumOrderBy)
    ? (rawOrderBy as AlbumOrderBy)
    : 'title'
  const rawDirection = getParam('albumOrderDirection', OrderDirection.ASC)
  const orderDirection = Object.values(OrderDirection).includes(
    rawDirection as OrderDirection
  )
    ? (rawDirection as OrderDirection)
    : OrderDirection.ASC

  const setViewStatus = useCallback(
    (value: AlbumViewStatus) =>
      setParam('viewed', value === 'all' ? null : value),
    [setParam]
  )
  const setOnlyFeatured = useCallback(
    (value: boolean) => setParam('featured', value ? '1' : null),
    [setParam]
  )
  const setOrdering: SetOrderingFn = useCallback(
    ({ orderBy, orderDirection }) => {
      const updates: UrlKeyValuePair[] = []
      if (orderBy !== undefined) {
        updates.push({ key: 'albumOrderBy', value: orderBy })
      }
      if (orderDirection !== undefined) {
        updates.push({
          key: 'albumOrderDirection',
          value: orderDirection,
        })
      }
      setParams(updates)
    },
    [setParams]
  )

  return {
    viewStatus,
    setViewStatus,
    onlyFeatured,
    setOnlyFeatured,
    ordering: { orderBy, orderDirection },
    setOrdering,
  }
}

export type AlbumEngagementParams = ReturnType<
  typeof useAlbumEngagementParams
>

export default useAlbumEngagementParams
