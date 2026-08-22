import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ProtectedImage } from '../photoGallery/ProtectedMedia'
import { useTranslation } from 'react-i18next'
import { MobileAlbumLayout } from './mobileAlbumLayout'
import AlbumFeaturedButton from '../album/AlbumFeaturedButton'

export type AlbumCardAlbum = {
  id: string
  title: string
  viewerState?: {
    featured: boolean
    viewCount: number
    lastViewedAt?: string | null
  }
  thumbnail?: null | {
    thumbnail?: null | {
      url: string
      width?: number | null
      height?: number | null
    }
  }
}

interface AlbumBoxImageProps {
  src?: string
  width?: number
  height?: number
  layout: MobileAlbumLayout
  children?: React.ReactNode
}

const AlbumBoxImage = ({
  src,
  width,
  height,
  layout,
  children,
  ...props
}: AlbumBoxImageProps) => {
  const [loaded, setLoaded] = useState(false)
  const listLayout = layout === 'list'

  let image = null
  if (src) {
    image = (
      <ProtectedImage
        className="absolute inset-0 object-cover object-center w-full h-full rounded-lg"
        {...props}
        onLoad={() => setLoaded(true)}
        src={src}
      />
    )
  }

  let placeholder = null
  if (!loaded) {
    placeholder = (
      <div className="bg-gray-100 dark:bg-[#191c1f] animate-pulse w-full h-full rounded-lg absolute inset-0"></div>
    )
  }

  return (
    <div
      data-testid="album-cover-frame"
      className={`mobile-album-cover-frame relative flex-none overflow-hidden rounded-lg xs:h-[220px] xs:w-[220px] ${
        listLayout ? 'h-20 w-20' : 'w-full'
      }`}
      style={
        {
          '--album-cover-aspect-ratio': `${width || 3} / ${height || 4}`,
        } as React.CSSProperties
      }
    >
      {image}
      {placeholder}
      {children}
    </div>
  )
}

const AlbumFolderIcon = () => (
  <svg
    aria-hidden="true"
    className="h-3.5 w-3.5 flex-none"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h3.2c.46 0 .9.21 1.18.58L9.45 5H16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-10Z" />
  </svg>
)

const ViewedIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4 flex-none"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
)

const LastOpenedIcon = () => (
  <svg
    aria-hidden="true"
    className="h-3.5 w-3.5 flex-none"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 3.25a6.75 6.75 0 1 0 6.75 6.75" />
    <path d="M10 6v4l2.65 1.55" />
    <path d="M10 3.25v2.4" />
  </svg>
)

type AlbumBoxProps = {
  album?: AlbumCardAlbum
  customLink?: string
  layout: MobileAlbumLayout
  navigationState?: unknown
  onAlbumClick?(
    album: AlbumCardAlbum,
    event: React.MouseEvent<HTMLAnchorElement>
  ): void
  isLastOpened?: boolean
  wasRestored?: boolean
}

export const AlbumBox = ({
  album,
  customLink,
  layout,
  navigationState,
  onAlbumClick,
  isLastOpened = false,
  wasRestored = false,
  ...props
}: AlbumBoxProps) => {
  const { t } = useTranslation()
  const listLayout = layout === 'list'
  const compactBadge = layout === 'columns-3' || layout === 'columns-4'
  const wrapperClasses = `mobile-album-card mb-3 w-full break-inside-avoid text-gray-900 dark:text-gray-200 xs:inline-block xs:mx-3 xs:my-2 xs:h-60 xs:w-[220px] xs:text-center ${
    listLayout
      ? 'mobile-album-card-list flex items-center gap-3 rounded-lg bg-gray-50 p-2 text-left dark:bg-dark-bg2 xs:block xs:bg-transparent xs:p-0 dark:xs:bg-transparent'
      : 'inline-block text-center'
  }`

  const thumbnail = album?.thumbnail?.thumbnail
  const badge = (
    <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-xs text-white shadow-sm">
      <AlbumFolderIcon />
      <span className={compactBadge ? 'sr-only xs:not-sr-only' : ''}>
        {t('album_layout.album_badge', 'Album')}
      </span>
    </span>
  )
  const viewCount = album?.viewerState?.viewCount || 0
  const viewedLabel = t(
    'album_engagement.view_count',
    'Viewed {{count}} times',
    { count: viewCount }
  )
  const viewedBadge =
    viewCount > 0 ? (
      <span
        aria-label={viewedLabel}
        className="absolute left-1 top-1 inline-flex min-h-[28px] items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-xs font-medium text-white shadow-sm"
      >
        <ViewedIcon />
        <span>{listLayout ? viewedLabel : viewCount}</span>
      </span>
    ) : null
  const lastOpenedLabel = t('album_navigation.last_opened', 'Last opened')
  const lastOpenedBadge = isLastOpened ? (
    <span
      aria-label={lastOpenedLabel}
      className={`absolute bottom-1 right-1 z-10 inline-flex min-h-[24px] items-center gap-1 rounded-full bg-sky-600/90 px-1.5 py-0.5 text-xs font-medium text-white shadow-sm ${
        wasRestored ? 'animate-pulse ring-2 ring-sky-200/80' : ''
      }`}
    >
      <LastOpenedIcon />
      <span className={compactBadge ? 'sr-only' : ''}>{lastOpenedLabel}</span>
    </span>
  ) : null
  const cardClasses = `${wrapperClasses} ${
    isLastOpened
      ? wasRestored
        ? 'rounded-lg ring-2 ring-sky-400 ring-offset-2 dark:ring-offset-dark-bg'
        : 'rounded-lg ring-1 ring-sky-400/80 ring-offset-1 dark:ring-offset-dark-bg'
      : ''
  }`

  if (album) {
    return (
      <div className="relative w-full xs:inline-block xs:w-auto">
        <Link
          to={customLink || `/album/${album.id}`}
          state={navigationState}
          data-album-id={album.id}
          data-last-opened={isLastOpened ? 'true' : undefined}
          data-return-restored={wasRestored ? 'true' : undefined}
          className={cardClasses}
          onClick={event => onAlbumClick?.(album, event)}
          {...props}
        >
          <AlbumBoxImage
            src={thumbnail?.url}
            width={thumbnail?.width || undefined}
            height={thumbnail?.height || undefined}
            layout={layout}
          >
            {viewedBadge}
            {badge}
            {lastOpenedBadge}
          </AlbumBoxImage>
          <div className={listLayout ? 'min-w-0 flex-1' : 'mt-1'}>
            <p className="whitespace-nowrap overflow-hidden overflow-ellipsis">
              {album.title}
            </p>
          </div>
        </Link>
        {album.viewerState && (
          <AlbumFeaturedButton
            albumId={album.id}
            featured={album.viewerState.featured}
            viewCount={album.viewerState.viewCount}
            lastViewedAt={album.viewerState.lastViewedAt}
            className="absolute right-1 top-1 z-20 bg-black/65 shadow-sm"
          />
        )}
      </div>
    )
  }

  return (
    <div className={wrapperClasses} {...props}>
      <AlbumBoxImage layout={layout} />
    </div>
  )
}
