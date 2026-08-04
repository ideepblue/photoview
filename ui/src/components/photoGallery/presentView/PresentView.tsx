import React, { useEffect } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import PresentNavigationOverlay from './PresentNavigationOverlay'
import PresentSwipeTrack from './PresentSwipeTrack'
import { closePresentModeAction, GalleryAction } from '../mediaGalleryReducer'
import { MediaGalleryFields } from '../__generated__/MediaGalleryFields'

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
  * {
    overflow: hidden !important;
  }
`

type PresentViewProps = {
  className?: string
  imageLoaded?(): void
  media: MediaGalleryFields[]
  activeIndex: number
  dispatchMedia: React.Dispatch<GalleryAction>
  disableSaveCloseInHistory?: boolean
}

const PresentView = ({
  className,
  imageLoaded,
  media,
  activeIndex,
  dispatchMedia,
  disableSaveCloseInHistory,
}: PresentViewProps) => {
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

  return (
    <StyledContainer className={className}>
      <PreventScroll />
      <PresentNavigationOverlay
        dispatchMedia={dispatchMedia}
        disableSaveCloseInHistory
      >
        <PresentSwipeTrack
          currentMedia={media[activeIndex]}
          previousMedia={media[(activeIndex - 1 + media.length) % media.length]}
          nextMedia={media[(activeIndex + 1) % media.length]}
          imageLoaded={imageLoaded}
          onNavigate={type => dispatchMedia({ type })}
        />
      </PresentNavigationOverlay>
    </StyledContainer>
  )
}

export default PresentView
