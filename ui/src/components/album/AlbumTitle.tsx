import React, { useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { SidebarContext } from '../sidebar/Sidebar'
import AlbumSidebar from '../sidebar/AlbumSidebar'
import { useLazyQuery, gql } from '@apollo/client'
import { authToken } from '../../helpers/authentication'
import { albumPathQuery } from './__generated__/albumPathQuery'
import useDelay from '../../hooks/useDelay'

import { ReactComponent as GearIcon } from './icons/gear.svg'
import { tailwindClassNames } from '../../helpers/utils'
import { buttonStyles } from '../../primitives/form/Input'
import { useTranslation } from 'react-i18next'

export const BreadcrumbList = styled.ol<{ hideLastArrow?: boolean }>`
  &
    ${({ hideLastArrow }) =>
      hideLastArrow ? 'li:not(:last-child)::after' : 'li::after'} {
    content: '';
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5px' height='6px' viewBox='0 0 5 6'%3E%3Cpolyline fill='none' stroke='%23979797' points='0.74 0.167710644 3.57228936 3 0.74 5.83228936' /%3E%3C/svg%3E");
    width: 5px;
    height: 6px;
    display: inline-block;
    margin: 6px;
    vertical-align: middle;
  }
`

export const ALBUM_PATH_QUERY = gql`
  query albumPathQuery($id: ID!) {
    album(id: $id) {
      id
      path {
        id
        title
      }
    }
  }
`

type AlbumTitleProps = {
  album?: {
    id: string
    title: string
  }
  disableLink: boolean
}

const AlbumTitle = ({ album, disableLink = false }: AlbumTitleProps) => {
  const [fetchPath, { data: pathData }] =
    useLazyQuery<albumPathQuery>(ALBUM_PATH_QUERY)
  const { updateSidebar } = useContext(SidebarContext)
  const { t } = useTranslation()
  const isAuthenticated = Boolean(authToken())

  useEffect(() => {
    if (!album) return

    if (isAuthenticated && disableLink == true) {
      fetchPath({
        variables: {
          id: album.id,
        },
      })
    }
  }, [album?.id, disableLink, fetchPath, isAuthenticated])

  const delay = useDelay(200, [album])

  if (!album) {
    return (
      <div
        className={`flex mb-6 flex-col h-14 transition-opacity animate-pulse ${
          delay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="w-32 h-4 bg-gray-100 mb-2 mt-1"></div>
        <div className="w-72 h-6 bg-gray-100"></div>
      </div>
    )
  }

  let title = <span>{album.title}</span>

  const path = pathData?.album.path || []
  const parent = path[0]

  let backNavigation: React.ReactNode = null
  if (isAuthenticated && disableLink) {
    if (pathData?.album) {
      const backTarget = parent ? `/album/${parent.id}` : '/albums'
      const backLabel = parent
        ? t('album_navigation.back_to_parent', 'Back to parent album')
        : t('album_navigation.back_to_albums', 'Back to albums')

      backNavigation = (
        <Link
          to={backTarget}
          aria-label={backLabel}
          title={backLabel}
          className={tailwindClassNames(
            buttonStyles({}),
            'h-11 w-11 mr-2 flex flex-shrink-0 items-center justify-center px-0 py-0'
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )
    } else {
      backNavigation = (
        <span className="h-11 w-11 mr-2 flex-shrink-0" aria-hidden="true" />
      )
    }
  }

  const breadcrumbSections = path
    .slice()
    .reverse()
    .map(x => (
      <li key={x.id} className="inline-block hover:underline">
        <Link to={`/album/${x.id}`}>{x.title}</Link>
      </li>
    ))

  if (!disableLink) {
    title = <Link to={`/album/${album.id}`}>{title}</Link>
  }

  return (
    <div className="flex mb-6 items-center min-h-[3.5rem]">
      {backNavigation}
      <div className="min-w-0 flex-1">
        <nav aria-label="Album breadcrumb">
          <BreadcrumbList>{breadcrumbSections}</BreadcrumbList>
        </nav>
        <h1 className="text-2xl truncate min-w-0">{title}</h1>
      </div>
      {authToken() && (
        <button
          title="Album options"
          aria-label="Album options"
          className={tailwindClassNames(
            buttonStyles({}),
            'px-2 py-2 ml-2 flex-shrink-0'
          )}
          onClick={() => {
            updateSidebar(<AlbumSidebar albumId={album.id} />)
          }}
        >
          <GearIcon />
        </button>
      )}
    </div>
  )
}

export default AlbumTitle
