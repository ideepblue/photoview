import { gql, useMutation } from '@apollo/client'
import classNames from 'classnames'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  setAlbumFeatured,
  setAlbumFeaturedVariables,
} from './__generated__/setAlbumFeatured'

export const SET_ALBUM_FEATURED_MUTATION = gql`
  mutation setAlbumFeatured($albumId: ID!, $featured: Boolean!) {
    setAlbumFeatured(albumID: $albumId, featured: $featured) {
      featured
      viewCount
      lastViewedAt
    }
  }
`

type AlbumFeaturedButtonProps = {
  albumId: string
  featured: boolean
  viewCount?: number
  lastViewedAt?: string | null
  className?: string
  contextPart?: string
  tone?: 'overlay' | 'surface'
}

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg
    aria-hidden="true"
    className="h-6 w-6"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.37l-5.7 3 1.09-6.36-4.62-4.5 6.38-.93L12 2.8Z" />
  </svg>
)

const AlbumFeaturedButton = ({
  albumId,
  featured,
  viewCount = 0,
  lastViewedAt = null,
  className,
  contextPart,
  tone = 'overlay',
}: AlbumFeaturedButtonProps) => {
  const { t } = useTranslation()
  const [optimisticFeatured, setOptimisticFeatured] = useState(featured)
  const [failure, setFailure] = useState(false)
  const [setFeatured, { loading }] = useMutation<
    setAlbumFeatured,
    setAlbumFeaturedVariables
  >(SET_ALBUM_FEATURED_MUTATION)

  useEffect(() => setOptimisticFeatured(featured), [featured])

  const addLabel = t(
    'album_featured.add',
    'Add album to featured'
  )
  const removeLabel = t(
    'album_featured.remove',
    'Remove album from featured'
  )
  const failureLabel = t(
    'album_featured.error',
    'Could not update featured album'
  )

  const toggleFeatured = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const previous = optimisticFeatured
    const next = !previous
    setFailure(false)
    setOptimisticFeatured(next)

    try {
      await setFeatured({
        variables: { albumId, featured: next },
        optimisticResponse: {
          setAlbumFeatured: {
            __typename: 'AlbumViewerState',
            featured: next,
            viewCount,
            lastViewedAt,
          },
        },
        update: (cache, result) => {
          const viewerState = result.data?.setAlbumFeatured
          if (!viewerState) return

          cache.modify({
            id: cache.identify({ __typename: 'Album', id: albumId }),
            fields: {
              viewerState: () => viewerState,
            },
          })
        },
      })
    } catch {
      setOptimisticFeatured(previous)
      setFailure(true)
    }
  }

  const label = optimisticFeatured ? removeLabel : addLabel

  return (
    <>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={optimisticFeatured}
        data-context-part={contextPart}
        disabled={loading}
        className={classNames(
          'inline-flex h-11 w-11 flex-none items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-70',
          optimisticFeatured
            ? 'text-yellow-400'
            : tone === 'surface'
            ? 'text-gray-600 dark:text-gray-100'
            : 'text-white',
          className
        )}
        onClick={toggleFeatured}
      >
        <StarIcon filled={optimisticFeatured} />
      </button>
      {failure && (
        <span
          role="alert"
          aria-label={failureLabel}
          className="pointer-events-none fixed left-1/2 top-4 z-[130] -translate-x-1/2 rounded-md bg-red-700 px-3 py-2 text-sm text-white shadow-lg"
        >
          {failureLabel}
        </span>
      )}
    </>
  )
}

export default AlbumFeaturedButton
