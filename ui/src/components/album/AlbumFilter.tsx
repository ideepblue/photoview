import React from 'react'
import { authToken } from '../../helpers/authentication'
import { useTranslation } from 'react-i18next'
import { OrderDirection } from '../../__generated__/globalTypes'
import { MediaOrdering, SetOrderingFn } from '../../hooks/useOrderingParams'
import Checkbox from '../../primitives/form/Checkbox'

import { ReactComponent as SortingIcon } from './icons/sorting.svg'
import { ReactComponent as DirectionIcon } from './icons/direction-arrow.svg'

import Dropdown from '../../primitives/form/Dropdown'
import classNames from 'classnames'
import AlbumScanControl from './AlbumScanControl'
import {
  AlbumEngagementParams,
  AlbumViewStatus,
} from '../../hooks/useAlbumEngagementParams'

export type SortingOptionValue =
  | 'date_shot'
  | 'updated_at'
  | 'title'
  | 'type'
  | 'view_count'
  | 'last_viewed_at'
export type SortingOption = { value: SortingOptionValue; label: string }

export type FavoriteCheckboxProps = {
  onlyFavorites: boolean
  setOnlyFavorites(favorites: boolean): void
}

export const FavoritesCheckbox = ({
  onlyFavorites,
  setOnlyFavorites,
}: FavoriteCheckboxProps) => {
  const { t } = useTranslation()

  return (
    <Checkbox
      className="mb-1"
      label={t('album_filter.only_favorites', 'Show only favorites')}
      checked={onlyFavorites}
      onChange={e => setOnlyFavorites(e.target.checked)}
    />
  )
}

type SortingOptionsProps = {
  ordering?: MediaOrdering
  setOrdering?: SetOrderingFn
  items?: SortingOption[]
  label?: string
  idPrefix?: string
  directionLabel?: string
}

const SortingOptions = ({
  setOrdering,
  ordering,
  items,
  label,
  idPrefix = 'filter_group_sort',
  directionLabel,
}: SortingOptionsProps) => {
  const { t } = useTranslation()

  const changeOrderDirection = () => {
    if (setOrdering && ordering) {
      setOrdering({
        orderDirection:
          ordering.orderDirection === OrderDirection.ASC
            ? OrderDirection.DESC
            : OrderDirection.ASC,
      })
    }
  }

  const changeOrderBy = (value: SortingOptionValue) => {
    if (setOrdering) {
      setOrdering({ orderBy: value })
    }
  }

  const defaultOptions = React.useMemo(
    () => [
      {
        value: 'date_shot',
        label: t('album_filter.sorting_options.date_shot', 'Date shot'),
      },
      {
        value: 'updated_at',
        label: t('album_filter.sorting_options.date_imported', 'Date imported'),
      },
      {
        value: 'title',
        label: t('album_filter.sorting_options.title', 'Title'),
      },
      {
        value: 'type',
        label: t('album_filter.sorting_options.type', 'Kind'),
      },
    ],
    [t]
  )

  const sortingOptions = items ?? defaultOptions
  const sortLabel = label ?? t('album_filter.sort', 'Sort')
  const sortDirectionLabel =
    directionLabel ?? t('album_filter.sort_direction', 'Sort direction')

  return (
    <fieldset>
      <legend id={`${idPrefix}-label`} className="inline-block mb-1">
        <SortingIcon
          className="inline-block align-baseline mr-1 mt-1"
          aria-hidden="true"
        />
        <span>{sortLabel}</span>
      </legend>
      <div>
        <Dropdown
          aria-labelledby={`${idPrefix}-label`}
          setSelected={changeOrderBy}
          value={ordering?.orderBy || undefined}
          items={sortingOptions}
        />
        <button
          title={sortDirectionLabel}
          aria-label={sortDirectionLabel}
          aria-pressed={ordering?.orderDirection === OrderDirection.DESC}
          className={classNames(
            'bg-gray-50 h-[30px] align-top px-2 py-1 rounded ml-2 border border-gray-200 focus:outline-none focus:border-blue-300 text-[#8b8b8b] hover:bg-gray-100 hover:text-[#777]',
            'dark:bg-dark-input-bg dark:border-dark-input-border dark:text-dark-input-text dark:focus:border-blue-300',
            { 'flip-y': ordering?.orderDirection === OrderDirection.ASC }
          )}
          onClick={changeOrderDirection}
        >
          <DirectionIcon />
          <span className="sr-only">
            {ordering?.orderDirection === OrderDirection.ASC
              ? t('album_filter.order_direction.ascending', 'Ascending')
              : t('album_filter.order_direction.descending', 'Descending')}
          </span>
        </button>
      </div>
    </fieldset>
  )
}

const AlbumEngagementControls = ({
  viewStatus,
  setViewStatus,
  onlyFeatured,
  setOnlyFeatured,
  ordering,
  setOrdering,
}: AlbumEngagementParams) => {
  const { t } = useTranslation()
  const statusOptions: Array<{
    value: AlbumViewStatus
    label: string
  }> = [
    { value: 'all', label: t('album_filter.albums.all', 'All albums') },
    {
      value: 'viewed',
      label: t('album_filter.albums.viewed', 'Viewed albums'),
    },
    {
      value: 'unviewed',
      label: t('album_filter.albums.unviewed', 'Unviewed albums'),
    },
  ]
  const sortOptions: SortingOption[] = [
    {
      value: 'title',
      label: t('album_filter.sorting_options.title', 'Title'),
    },
    {
      value: 'updated_at',
      label: t('album_filter.sorting_options.date_imported', 'Date imported'),
    },
    {
      value: 'view_count',
      label: t('album_filter.sorting_options.view_count', 'View count'),
    },
    {
      value: 'last_viewed_at',
      label: t(
        'album_filter.sorting_options.last_viewed_at',
        'Recently viewed'
      ),
    },
  ]

  return (
    <>
      <fieldset>
        <legend className="mb-1">
          {t('album_filter.albums.view_status', 'Album view status')}
        </legend>
        <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-dark-input-border dark:bg-dark-input-bg">
          {statusOptions.map(option => (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={viewStatus === option.value}
              className={classNames(
                'min-h-[30px] rounded px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300',
                viewStatus === option.value
                  ? 'bg-white text-gray-900 shadow dark:bg-dark-bg dark:text-white'
                  : 'text-gray-500 dark:text-gray-300'
              )}
              onClick={() => setViewStatus(option.value)}
            >
              {option.label.replace(/ albums$/, '')}
            </button>
          ))}
        </div>
      </fieldset>
      <Checkbox
        className="mb-1"
        label={t(
          'album_filter.albums.only_featured',
          'Featured albums only'
        )}
        checked={onlyFeatured}
        onChange={event => setOnlyFeatured(event.target.checked)}
      />
      <SortingOptions
        label={t('album_filter.albums.sort', 'Album sort')}
        directionLabel={t(
          'album_filter.albums.sort_direction',
          'Album sort direction'
        )}
        idPrefix="album_sort"
        ordering={ordering}
        setOrdering={setOrdering}
        items={sortOptions}
      />
    </>
  )
}

type AlbumFilterProps = {
  onlyFavorites: boolean
  setOnlyFavorites?(favorites: boolean): void
  ordering?: MediaOrdering
  setOrdering?: SetOrderingFn
  sortingOptions?: SortingOption[]
  albumEngagement?: AlbumEngagementParams
  albumId?: string
  onAlbumScanComplete?(): Promise<unknown> | unknown
}

const AlbumFilter = ({
  onlyFavorites,
  setOnlyFavorites,
  setOrdering,
  ordering,
  sortingOptions,
  albumEngagement,
  albumId,
  onAlbumScanComplete,
}: AlbumFilterProps) => {
  return (
    <div className="flex items-end gap-4 flex-wrap mb-4">
      {ordering && setOrdering ? (
        <SortingOptions
          ordering={ordering}
          setOrdering={setOrdering}
          items={sortingOptions}
        />
      ) : null}
      {authToken() && setOnlyFavorites && (
        <FavoritesCheckbox
          onlyFavorites={onlyFavorites}
          setOnlyFavorites={setOnlyFavorites}
        />
      )}
      {albumEngagement && <AlbumEngagementControls {...albumEngagement} />}
      {albumId && onAlbumScanComplete && (
        <AlbumScanControl
          albumId={albumId}
          onScanComplete={onAlbumScanComplete}
        />
      )}
    </div>
  )
}

export default AlbumFilter
