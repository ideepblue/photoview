import React, { useEffect } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import PresentNavigationOverlay from './PresentNavigationOverlay'
import PresentSwipeTrack from './PresentSwipeTrack'
import { closePresentModeAction, GalleryAction } from '../mediaGalleryReducer'
import { PresentMediaFields } from './PresentMedia'

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
  media: PresentMediaFields[]
  activeIndex: number
  circular?: boolean
  dispatchMedia: React.Dispatch<GalleryAction>
  disableSaveCloseInHistory?: boolean
}

const PresentView = ({
  className,
  imageLoaded,
  media,
  activeIndex,
  circular = true,
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

  return (
    <StyledContainer className={className}>
      <PreventScroll />
      <PresentNavigationOverlay
        dispatchMedia={dispatchMedia}
        disableSaveCloseInHistory
      >
        <PresentSwipeTrack
          currentMedia={currentMedia}
          previousMedia={previousMedia}
          nextMedia={nextMedia}
          imageLoaded={imageLoaded}
          onNavigate={type => dispatchMedia({ type })}
        />
      </PresentNavigationOverlay>
    </StyledContainer>
  )
}

export default PresentView
