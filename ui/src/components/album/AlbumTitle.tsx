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
import { useMobileAlbumContextBarHandedness } from './mobileAlbumContextBarPreferences'
import AlbumFeaturedButton from './AlbumFeaturedButton'

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

const AlbumContextBar = styled.div`
  position: fixed;
  z-index: 29;
  right: 0.75rem;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 5.5rem);
  left: 0.75rem;
  display: flex;
  min-height: 4rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid rgba(209, 213, 219, 0.8);
  border-radius: 0.875rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px rgba(34, 20, 22, 0.28);
  backdrop-filter: blur(10px);

  body.dark &,
  html.dark & {
    border-color: rgba(75, 85, 99, 0.9);
    background: rgba(31, 35, 40, 0.96);
  }

  @media (min-width: 1024px) {
    position: static;
    z-index: auto;
    min-height: 3.5rem;
    margin-bottom: 1.5rem;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;

    body.dark &,
    html.dark & {
      background: transparent;
    }

    [data-context-part='back'] {
      order: 0;
    }

    [data-context-part='content'] {
      order: 1;
    }

    [data-context-part='options'] {
      order: 2;
    }

    [data-context-part='featured'] {
      order: 2;
    }
  }
`

const AlbumContextContent = styled.div`
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;

  nav {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    white-space: nowrap;
  }

  nav::-webkit-scrollbar {
    display: none;
  }
`

const BackIcon = () => (
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
    <path d="M20 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
)

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
    viewerState?: {
      featured: boolean
      viewCount: number
      lastViewedAt?: string | null
    }
  }
  disableLink: boolean
}

const AlbumTitle = ({ album, disableLink = false }: AlbumTitleProps) => {
  const [fetchPath, { data: pathData }] =
    useLazyQuery<albumPathQuery>(ALBUM_PATH_QUERY)
  const { updateSidebar } = useContext(SidebarContext)
  const { t } = useTranslation()
  const isAuthenticated = Boolean(authToken())
  const [handedness] = useMobileAlbumContextBarHandedness()

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
          key="back"
          to={backTarget}
          aria-label={backLabel}
          title={backLabel}
          data-context-part="back"
          className={tailwindClassNames(
            buttonStyles({}),
            'h-12 w-12 lg:h-11 lg:w-11 flex flex-shrink-0 items-center justify-center px-0 py-0'
          )}
        >
          <BackIcon />
        </Link>
      )
    } else {
      backNavigation = (
        <span
          key="back"
          data-context-part="back"
          className="h-12 w-12 lg:h-11 lg:w-11 flex-shrink-0"
          aria-hidden="true"
        />
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

  const content = (
    <AlbumContextContent key="content" data-context-part="content">
      <nav aria-label="Album breadcrumb">
        <BreadcrumbList>{breadcrumbSections}</BreadcrumbList>
      </nav>
      <h1 className="text-base lg:text-2xl truncate min-w-0">{title}</h1>
    </AlbumContextContent>
  )

  const options = isAuthenticated ? (
    <button
      key="options"
      title="Album options"
      aria-label="Album options"
      data-context-part="options"
      className={tailwindClassNames(
        buttonStyles({}),
        'h-12 w-12 lg:h-auto lg:w-auto px-0 py-0 lg:px-2 lg:py-2 flex flex-shrink-0 items-center justify-center'
      )}
      onClick={() => {
        updateSidebar(<AlbumSidebar albumId={album.id} />)
      }}
    >
      <GearIcon />
    </button>
  ) : null

  const featured =
    isAuthenticated && album.viewerState ? (
      <AlbumFeaturedButton
        key="featured"
        albumId={album.id}
        featured={album.viewerState.featured}
        viewCount={album.viewerState.viewCount}
        lastViewedAt={album.viewerState.lastViewedAt}
        contextPart="featured"
        tone="surface"
        className="rounded-md bg-gray-50 dark:bg-dark-bg2"
      />
    ) : null

  const contextParts =
    handedness === 'left'
      ? [options, featured, backNavigation, content]
      : [content, backNavigation, featured, options]

  return (
    <AlbumContextBar
      className="min-h-[3.5rem]"
      data-testid="album-context-bar"
      data-handedness={handedness}
    >
      {contextParts}
    </AlbumContextBar>
  )
}

export default AlbumTitle
