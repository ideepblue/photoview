import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ProtectedImage } from '../photoGallery/ProtectedMedia'
import { albumQuery_album_subAlbums } from '../../Pages/AlbumPage/__generated__/albumQuery'
import { useTranslation } from 'react-i18next'
import { MobileAlbumLayout } from './mobileAlbumLayout'

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

type AlbumBoxProps = {
  album?: albumQuery_album_subAlbums
  customLink?: string
  layout: MobileAlbumLayout
}

export const AlbumBox = ({
  album,
  customLink,
  layout,
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

  if (album) {
    return (
      <Link
        to={customLink || `/album/${album.id}`}
        className={wrapperClasses}
        {...props}
      >
        <AlbumBoxImage
          src={thumbnail?.url}
          width={thumbnail?.width}
          height={thumbnail?.height}
          layout={layout}
        >
          {badge}
        </AlbumBoxImage>
        <div className={listLayout ? 'min-w-0 flex-1' : 'mt-1'}>
          <p className="whitespace-nowrap overflow-hidden overflow-ellipsis">
            {album.title}
          </p>
        </div>
      </Link>
    )
  }

  return (
    <div className={wrapperClasses} {...props}>
      <AlbumBoxImage layout={layout} />
    </div>
  )
}
