import React, { useState, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'
import { useTranslation } from 'react-i18next'

import { SidebarSection, SidebarSectionTitle } from './SidebarComponents'

import {
  setAlbumCover,
  setAlbumCoverVariables,
} from './__generated__/setAlbumCover'
import {
  resetAlbumCover,
  resetAlbumCoverVariables,
} from './__generated__/resetAlbumCover'
import { authToken } from '../../helpers/authentication'

const RESET_ALBUM_COVER_MUTATION = gql`
  mutation resetAlbumCover($albumID: ID!) {
    resetAlbumCover(albumID: $albumID) {
      id
      thumbnail {
        id
        thumbnail {
          url
        }
      }
    }
  }
`
export const SET_ALBUM_COVER_MUTATION = gql`
  mutation setAlbumCover($coverID: ID!, $albumID: ID) {
    setAlbumCover(coverID: $coverID, albumID: $albumID) {
      id
      thumbnail {
        id
        thumbnail {
          url
        }
      }
    }
  }
`

type SidebarPhotoCoverProps = {
  cover_id: string
  album?: {
    id: string
    title: string
    path?: {
      id: string
      title: string
    }[]
  } | null
}

export const SidebarPhotoCover = ({
  cover_id,
  album,
}: SidebarPhotoCoverProps) => {
  const { t } = useTranslation()

  const [setAlbumCover] = useMutation<setAlbumCover, setAlbumCoverVariables>(
    SET_ALBUM_COVER_MUTATION
  )

  const [settingAlbumID, setSettingAlbumID] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    kind: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    setSettingAlbumID(null)
    setStatus(null)
  }, [cover_id, album?.id])

  // hide when not authenticated
  if (!authToken() || !album) {
    return null
  }

  const parent = album.path?.[0]
  const targets = [
    {
      ...album,
      label: t(
        'sidebar.album.set_cover_for_current',
        'Set as cover for current album “{{album}}”',
        { album: album.title }
      ),
    },
    ...(parent
      ? [
          {
            ...parent,
            label: t(
              'sidebar.album.set_cover_for_parent',
              'Set as cover for parent album “{{album}}”',
              { album: parent.title }
            ),
          },
        ]
      : []),
  ]

  const assignCover = async (target: { id: string; title: string }) => {
    setSettingAlbumID(target.id)
    setStatus(null)
    try {
      await setAlbumCover({
        variables: {
          coverID: cover_id,
          albumID: target.id,
        },
      })
      setStatus({
        kind: 'success',
        message: t('sidebar.album.cover_set_for', 'Cover set for “{{album}}”', {
          album: target.title,
        }),
      })
    } catch (_error) {
      setStatus({
        kind: 'error',
        message: t(
          'sidebar.album.set_cover_failed',
          'Could not set the cover. Please try again.'
        ),
      })
    } finally {
      setSettingAlbumID(null)
    }
  }

  return (
    <SidebarSection>
      <SidebarSectionTitle>
        {t('sidebar.album.album_cover', 'Album cover')}
      </SidebarSectionTitle>
      <div className="border-gray-100 dark:border-dark-border2 border-b border-t px-4 py-3">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          {t(
            'sidebar.album.set_cover_help',
            'Choose whether this photo should cover the current album or its parent album.'
          )}
        </p>
        <div className="flex flex-col items-start gap-3">
          {targets.map(target => (
            <button
              key={target.id}
              className="disabled:opacity-50 text-green-500 font-bold text-left text-sm"
              disabled={settingAlbumID !== null}
              onClick={() => assignCover(target)}
            >
              {settingAlbumID === target.id
                ? t('general.loading.default', 'Loading...')
                : target.label}
            </button>
          ))}
        </div>
        {status && (
          <p
            aria-live="polite"
            className={`mt-3 text-sm ${
              status.kind === 'success' ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {status.message}
          </p>
        )}
      </div>
    </SidebarSection>
  )
}

type SidebarAlbumCoverProps = {
  id: string
}

export const SidebarAlbumCover = ({ id }: SidebarAlbumCoverProps) => {
  const { t } = useTranslation()

  const [resetAlbumCover] = useMutation<
    resetAlbumCover,
    resetAlbumCoverVariables
  >(RESET_ALBUM_COVER_MUTATION, {
    variables: {
      albumID: id,
    },
  })

  const [buttonDisabled, setButtonDisabled] = useState(false)

  useEffect(() => {
    setButtonDisabled(false)
  }, [id])

  return (
    <SidebarSection>
      <SidebarSectionTitle>
        {t('sidebar.album.album_cover', 'Album cover')}
      </SidebarSectionTitle>
      <div>
        <table className="border-collapse w-full">
          <tfoot>
            <tr className="text-left border-gray-100 dark:border-dark-border2 border-b border-t">
              <td colSpan={2} className="pl-4 py-2">
                <button
                  className="disabled:opacity-50 text-red-500 font-bold uppercase text-xs"
                  disabled={buttonDisabled}
                  onClick={() => {
                    setButtonDisabled(true),
                      resetAlbumCover({
                        variables: {
                          albumID: id,
                        },
                      })
                  }}
                >
                  <span>
                    {t('sidebar.album.reset_cover', 'Reset cover photo')}
                  </span>
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </SidebarSection>
  )
}
