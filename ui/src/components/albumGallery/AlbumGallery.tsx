import React, { useEffect, useReducer } from 'react'
import AlbumTitle from '../album/AlbumTitle'
import MediaGallery, {
  MEDIA_GALLERY_FRAGMENT,
} from '../photoGallery/MediaGallery'
import AlbumBoxes from './AlbumBoxes'
import AlbumFilter from '../album/AlbumFilter'
import {
  mediaGalleryReducer,
  urlPresentModeSetupHook,
} from '../photoGallery/mediaGalleryReducer'
import { MediaOrdering, SetOrderingFn } from '../../hooks/useOrderingParams'
import { gql } from '@apollo/client'
import { AlbumGalleryFields } from './__generated__/AlbumGalleryFields'
import { useTranslation } from 'react-i18next'
import { AlbumEngagementParams } from '../../hooks/useAlbumEngagementParams'

const AlbumSectionIcon = () => (
  <svg
    aria-hidden="true"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h3.2c.46 0 .9.21 1.18.58L9.45 5H16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-10Z" />
  </svg>
)

export const ALBUM_GALLERY_FRAGMENT = gql`
  ${MEDIA_GALLERY_FRAGMENT}

  fragment AlbumGalleryFields on Album {
    id
    title
    viewerState {
      featured
      viewCount
      lastViewedAt
    }
    subAlbums(
      order: { order_by: $albumOrderBy, order_direction: $albumOrderDirection }
      viewFilter: $albumViewFilter
      onlyFeatured: $onlyFeaturedAlbums
    ) {
      id
      title
      viewerState {
        featured
        viewCount
        lastViewedAt
      }
      thumbnail {
        id
        thumbnail {
          url
          width
          height
        }
      }
    }
    media(
      paginate: { limit: $limit, offset: $offset }
      order: { order_by: $mediaOrderBy, order_direction: $orderDirection }
      onlyFavorites: $onlyFavorites
    ) {
      ...MediaGalleryFields
    }
  }
`

type AlbumGalleryProps = {
  album?: AlbumGalleryFields
  loading?: boolean
  customAlbumLink?(albumID: string): string
  showFilter?: boolean
  setOnlyFavorites?(favorites: boolean): void
  setOrdering?: SetOrderingFn
  ordering?: MediaOrdering
  onlyFavorites?: boolean
  onFavorite?(): void
  onAlbumScanComplete?(): Promise<unknown> | unknown
  albumEngagement?: AlbumEngagementParams
}

const AlbumGallery = React.forwardRef(
  (
    {
      album,
      loading = false,
      customAlbumLink,
      showFilter = false,
      setOnlyFavorites,
      setOrdering,
      ordering,
      onlyFavorites = false,
      onAlbumScanComplete,
      albumEngagement,
    }: AlbumGalleryProps,
    ref: React.ForwardedRef<HTMLDivElement>
  ) => {
    const { t } = useTranslation()
    const [mediaState, dispatchMedia] = useReducer(mediaGalleryReducer, {
      presenting: false,
      activeIndex: -1,
      media: album?.media || [],
    })

    useEffect(() => {
      dispatchMedia({ type: 'replaceMedia', media: album?.media || [] })
    }, [album?.media])

    urlPresentModeSetupHook({
      dispatchMedia,
      openPresentMode: event => {
        dispatchMedia({
          type: 'openPresentMode',
          activeIndex: event.state.activeIndex,
        })
      },
    })

    let subAlbumElement = null
    const hasSubAlbums = !!album && album.subAlbums.length > 0
    const hasMedia = !!album && album.media.length > 0

    if (album) {
      if (hasSubAlbums) {
        subAlbumElement = (
          <section aria-labelledby="subalbums-heading">
            <h2
              id="subalbums-heading"
              className="flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-gray-200"
            >
              <AlbumSectionIcon />
              {t('album_layout.subalbums', 'Subalbums')}
            </h2>
            <AlbumBoxes
              albums={album.subAlbums}
              getCustomLink={customAlbumLink}
            />
          </section>
        )
      }
    } else {
      subAlbumElement = <AlbumBoxes />
    }

    return (
      <div ref={ref}>
        {showFilter && (
          <AlbumFilter
            onlyFavorites={onlyFavorites}
            setOnlyFavorites={setOnlyFavorites}
            setOrdering={setOrdering}
            ordering={ordering}
            albumId={album?.id}
            onAlbumScanComplete={onAlbumScanComplete}
            albumEngagement={albumEngagement}
          />
        )}
        <AlbumTitle album={album} disableLink />
        {subAlbumElement}
        {hasSubAlbums && hasMedia && (
          <h2 className="mb-3 mt-5 text-lg font-semibold text-gray-700 dark:text-gray-200">
            {t('album_layout.photos', 'Photos')}
          </h2>
        )}
        <MediaGallery
          loading={loading}
          mediaState={mediaState}
          dispatchMedia={dispatchMedia}
        />
      </div>
    )
  }
)

export default AlbumGallery
