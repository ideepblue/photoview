import React, { useContext, useEffect } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import PresentNavigationOverlay from './PresentNavigationOverlay'
import PresentSwipeTrack from './PresentSwipeTrack'
import { closePresentModeAction, GalleryAction } from '../mediaGalleryReducer'
import { PresentMediaFields } from './PresentMedia'
import { SidebarContext } from '../../sidebar/Sidebar'
import MediaSidebar from '../../sidebar/MediaSidebar/MediaSidebar'
import { AlbumViewTracking } from './useAlbumViewTracking'

const StyledContainer = styled.div`
  position: fixed;
  width: 100vw;
  height: 100vh;
  background-color: black;
  color: white;
  top: 0;
  left: 0;
  z-index: 100;
`

const PreventScroll = createGlobalStyle`
  body {
    overflow: hidden !important;
  }
`

type PresentViewProps = {
  className?: string
  imageLoaded?(): void
  media: PresentMediaFields[]
  activeIndex: number
  circular?: boolean
  dispatchMedia: React.Dispatch<GalleryAction>
  disableSaveCloseInHistory?: boolean
  albumId?: string
  reportedAlbums?: Map<string, number>
}

const PresentView = ({
  className,
  imageLoaded,
  media,
  activeIndex,
  circular = true,
  dispatchMedia,
  disableSaveCloseInHistory,
  albumId,
  reportedAlbums,
}: PresentViewProps) => {
  const { updateSidebar } = useContext(SidebarContext)

  useEffect(() => {
    const keyDownEvent = (e: KeyboardEvent) => {
      if (e.key == 'ArrowRight') {
        e.stopPropagation()
        dispatchMedia({ type: 'nextImage' })
      }

      if (e.key == 'ArrowLeft') {
        e.stopPropagation()
        dispatchMedia({ type: 'previousImage' })
      }

      if (e.key == 'Escape') {
        e.stopPropagation()

        if (disableSaveCloseInHistory === true) {
          dispatchMedia({ type: 'closePresentMode' })
        } else {
          closePresentModeAction({ dispatchMedia })
        }
      }
    }

    document.addEventListener('keydown', keyDownEvent)

    return function cleanup() {
      document.removeEventListener('keydown', keyDownEvent)
    }
  })

  const currentMedia = media[activeIndex]
  if (currentMedia === undefined) return null

  const previousMedia =
    activeIndex > 0
      ? media[activeIndex - 1]
      : circular
      ? media[media.length - 1]
      : null
  const nextMedia =
    activeIndex < media.length - 1
      ? media[activeIndex + 1]
      : circular
      ? media[0]
      : null

  const viewer = (onViewingActive?: (active: boolean) => void) => (
    <StyledContainer className={className}>
      <PreventScroll />
      <PresentNavigationOverlay
        dispatchMedia={dispatchMedia}
        disableSaveCloseInHistory
        activeIndex={activeIndex}
        mediaCount={media.length}
        filename={currentMedia.title}
        onShowInfo={() => {
          updateSidebar(<MediaSidebar media={currentMedia} hidePreview />)
        }}
      >
        {showControls => (
          <PresentSwipeTrack
            currentMedia={currentMedia}
            previousMedia={previousMedia}
            nextMedia={nextMedia}
            imageLoaded={imageLoaded}
            onViewingActive={onViewingActive}
            onNavigate={type => dispatchMedia({ type })}
            onTap={showControls}
          />
        )}
      </PresentNavigationOverlay>
    </StyledContainer>
  )

  if (albumId) {
    return (
      <AlbumViewTracking
        albumId={albumId}
        mediaId={currentMedia.id}
        reportedAlbums={reportedAlbums}
      >
        {viewer}
      </AlbumViewTracking>
    )
  }

  return viewer()
}

export default PresentView
