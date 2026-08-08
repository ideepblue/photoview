import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { albumQuery_album_subAlbums } from '../../Pages/AlbumPage/__generated__/albumQuery'
import { AlbumBox } from './AlbumBox'
import {
  MobileAlbumLayout,
  readMobileAlbumLayout,
  writeMobileAlbumLayout,
} from './mobileAlbumLayout'

type AlbumBoxesProps = {
  error?: Error
  albums?: albumQuery_album_subAlbums[]
  getCustomLink?(albumID: string): string
}

const mobileAlbumLayoutClass: Record<MobileAlbumLayout, string> = {
  list: 'mobile-album-list',
  'columns-2': 'mobile-album-grid-2',
  'columns-3': 'mobile-album-grid-3',
  'columns-4': 'mobile-album-grid-4',
}

const AlbumBoxes = ({ error, albums, getCustomLink }: AlbumBoxesProps) => {
  const { t } = useTranslation()
  const [layout, setLayout] = useState<MobileAlbumLayout>(() =>
    readMobileAlbumLayout()
  )

  if (error) return <div>Error {error.message}</div>

  let albumElements = []

  if (albums !== undefined) {
    albumElements = albums.map(album => (
      <AlbumBox
        key={album.id}
        album={album}
        layout={layout}
        customLink={getCustomLink ? getCustomLink(album.id) : undefined}
      />
    ))
  } else {
    for (let i = 0; i < 4; i++) {
      albumElements.push(<AlbumBox key={i} layout={layout} />)
    }
  }

  const selectLayout = (nextLayout: MobileAlbumLayout) => {
    setLayout(nextLayout)
    writeMobileAlbumLayout(nextLayout)
  }

  const layoutOptions: Array<{
    value: MobileAlbumLayout
    label: string
    shortLabel: string
  }> = [
    {
      value: 'list',
      label: t('album_layout.list', 'Compact list'),
      shortLabel: '≡',
    },
    {
      value: 'columns-2',
      label: t('album_layout.columns_2', '2 columns'),
      shortLabel: '2',
    },
    {
      value: 'columns-3',
      label: t('album_layout.columns_3', '3 columns'),
      shortLabel: '3',
    },
    {
      value: 'columns-4',
      label: t('album_layout.columns_4', '4 columns'),
      shortLabel: '4',
    },
  ]

  return (
    <>
      <div
        className="mb-2 flex justify-end xs:hidden"
        role="group"
        aria-label={t('album_layout.label', 'Album layout')}
      >
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 shadow-sm dark:border-dark-border2 dark:bg-dark-bg2">
          {layoutOptions.map(option => {
            const selected = layout === option.value

            return (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={selected}
                className={`min-w-[36px] rounded-md px-2 py-1 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                  selected
                    ? 'bg-white text-gray-900 shadow dark:bg-dark-bg dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
                onClick={() => selectLayout(option.value)}
              >
                <span aria-hidden="true">{option.shortLabel}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div
        data-testid="album-boxes"
        data-mobile-layout={layout}
        className={`${mobileAlbumLayoutClass[layout]} my-4 xs:my-6 xs:block xs:-mx-3`}
      >
        {albumElements}
      </div>
    </>
  )
}

export default AlbumBoxes
