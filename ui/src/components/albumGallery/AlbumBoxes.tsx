import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlbumBox, AlbumCardAlbum } from './AlbumBox'
import {
  MobileAlbumLayout,
  readMobileAlbumLayout,
  writeMobileAlbumLayout,
} from './mobileAlbumLayout'
import {
  albumListParentKey,
  albumListPresentationKey,
  getAlbumListReturnRecord,
  hasAlbumListRestoreIntent,
  mergeAlbumListReturnTarget,
  saveAlbumListReturnRecord,
  withAlbumListRestoreIntent,
} from './albumListReturnContext'
import { useAlbumListReturnRestore } from './useAlbumListReturnRestore'

type AlbumBoxesProps = {
  error?: Error
  albums?: AlbumCardAlbum[]
  getCustomLink?(albumID: string): string
}

const mobileAlbumLayoutClass: Record<MobileAlbumLayout, string> = {
  list: 'mobile-album-list',
  'columns-2': 'mobile-album-lanes mobile-album-lanes-2',
  'columns-3': 'mobile-album-lanes mobile-album-lanes-3',
  'columns-4': 'mobile-album-lanes mobile-album-lanes-4',
}

const MOBILE_ALBUM_BREAKPOINT = 480
// Layout uses mx-3 on both sides below the mobile breakpoint.
const MOBILE_ALBUM_CONTENT_HORIZONTAL_MARGIN = 24
// Cover title line (24px) + mt-1 (4px) + mb-3 (12px).
const MOBILE_ALBUM_CARD_CHROME_HEIGHT = 40
const MOBILE_ALBUM_COLUMN_GAP: Record<number, number> = {
  2: 8,
  3: 6,
  4: 4,
}

const mobileAlbumViewportWidth = () => {
  if (
    typeof window === 'undefined' ||
    window.innerWidth >= MOBILE_ALBUM_BREAKPOINT
  ) {
    return null
  }

  return window.innerWidth
}

const mobileAlbumColumnCount = (layout: MobileAlbumLayout) => {
  switch (layout) {
    case 'columns-2':
      return 2
    case 'columns-3':
      return 3
    case 'columns-4':
      return 4
    default:
      return 0
  }
}

const validDimension = (value?: number | null) =>
  value && value > 0 ? value : undefined

const estimateAlbumCardHeight = (
  album: AlbumCardAlbum | undefined,
  laneWidth: number
) => {
  const thumbnail = album?.thumbnail?.thumbnail
  const width = validDimension(thumbnail?.width) || 3
  const height = validDimension(thumbnail?.height) || 4
  const titleAndSpacing = album ? MOBILE_ALBUM_CARD_CHROME_HEIGHT : 12

  return laneWidth * (height / width) + titleAndSpacing
}

const AlbumBoxes = ({ error, albums, getCustomLink }: AlbumBoxesProps) => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [layout, setLayout] = useState<MobileAlbumLayout>(() =>
    readMobileAlbumLayout()
  )
  const [mobileViewportWidth, setMobileViewportWidth] = useState(
    mobileAlbumViewportWidth
  )
  const albumBoxesRef = useRef<HTMLDivElement>(null)
  const parentListKey = albumListParentKey(location.pathname)
  const [lastOpenedAlbumId, setLastOpenedAlbumId] = useState<string>()

  useEffect(() => {
    setLastOpenedAlbumId(
      parentListKey
        ? getAlbumListReturnRecord(parentListKey)?.albumId
        : undefined
    )
  }, [parentListKey])

  useEffect(() => {
    const updateViewport = () =>
      setMobileViewportWidth(mobileAlbumViewportWidth())

    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const currentListTarget = `${location.pathname}${location.search}${location.hash}`
  const presentationKey = parentListKey
    ? albumListPresentationKey(parentListKey, location.search, layout)
    : undefined
  const navigationState = parentListKey
    ? mergeAlbumListReturnTarget(location.state, {
        parentListKey,
        to: currentListTarget,
      })
    : undefined
  const restoredAlbum = useAlbumListReturnRestore({
    parentListKey,
    presentationKey,
    albumsReady: albums !== undefined,
    shouldRestore: hasAlbumListRestoreIntent(location.state),
    rootRef: albumBoxesRef,
  })

  const handleAlbumClick = (
    album: AlbumCardAlbum,
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    if (
      !parentListKey ||
      !presentationKey ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return
    }

    event.preventDefault()

    const cardViewportOffset = event.currentTarget.getBoundingClientRect().top
    saveAlbumListReturnRecord({
      parentListKey,
      presentationKey,
      albumId: album.id,
      albumTitle: album.title,
      scrollY: Math.max(window.scrollY || window.pageYOffset || 0, 0),
      cardViewportOffset,
      updatedAt: Date.now(),
    })
    setLastOpenedAlbumId(album.id)

    navigate(currentListTarget, {
      replace: true,
      state: withAlbumListRestoreIntent(location.state),
    })
    navigate(getCustomLink ? getCustomLink(album.id) : `/album/${album.id}`, {
      state: navigationState,
    })
  }

  if (error) return <div>Error {error.message}</div>

  let albumCards: Array<{
    album?: AlbumCardAlbum
    element: React.ReactElement
  }> = []

  if (albums !== undefined) {
    albumCards = albums.map(album => ({
      album,
      element: (
        <AlbumBox
          key={album.id}
          album={album}
          layout={layout}
          customLink={getCustomLink ? getCustomLink(album.id) : undefined}
          navigationState={navigationState}
          onAlbumClick={handleAlbumClick}
          isLastOpened={lastOpenedAlbumId === album.id}
          wasRestored={restoredAlbum?.albumId === album.id}
        />
      ),
    }))
  } else {
    for (let i = 0; i < 4; i++) {
      albumCards.push({
        element: <AlbumBox key={i} layout={layout} />,
      })
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

  const columnCount =
    mobileViewportWidth === null ? 0 : mobileAlbumColumnCount(layout)
  const albumColumns = columnCount
    ? Array.from({ length: columnCount }, () => [] as React.ReactElement[])
    : null

  if (albumColumns) {
    const gap = MOBILE_ALBUM_COLUMN_GAP[columnCount] || 0
    const laneWidth = Math.max(
      (mobileViewportWidth! -
        MOBILE_ALBUM_CONTENT_HORIZONTAL_MARGIN -
        gap * (columnCount - 1)) /
        columnCount,
      1
    )
    const laneHeights = Array.from({ length: columnCount }, () => 0)

    albumCards.forEach(({ album, element }) => {
      let shortestLane = 0

      for (let lane = 1; lane < columnCount; lane++) {
        if (laneHeights[lane] < laneHeights[shortestLane]) {
          shortestLane = lane
        }
      }

      albumColumns[shortestLane].push(element)
      laneHeights[shortestLane] += estimateAlbumCardHeight(album, laneWidth)
    })
  }

  const albumElements = albumCards.map(card => card.element)

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
        ref={albumBoxesRef}
        data-testid="album-boxes"
        data-mobile-layout={layout}
        className={`${mobileAlbumLayoutClass[layout]} my-4 xs:my-6 xs:block xs:-mx-3`}
      >
        {albumColumns
          ? albumColumns.map((column, index) => (
              <div
                key={index}
                data-testid="album-lane"
                className="mobile-album-lane"
              >
                {column}
              </div>
            ))
          : albumElements}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {restoredAlbum
          ? t('album_navigation.returned_to', 'Returned to {{title}}', {
              title: restoredAlbum.albumTitle,
            })
          : ''}
      </span>
    </>
  )
}

export default AlbumBoxes
