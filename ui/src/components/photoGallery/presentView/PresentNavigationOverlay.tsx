import React, { useState, useRef, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import { closePresentModeAction, GalleryAction } from '../mediaGalleryReducer'
import { useTranslation } from 'react-i18next'

import ExitIcon from './icons/Exit'
import InfoIcon from './icons/Info'
import NextIcon from './icons/Next'
import PrevIcon from './icons/Previous'

const StyledOverlayContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`

const OverlayButton = styled.button`
  width: 64px;
  height: 64px;
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  position: absolute;
  z-index: 2;

  & svg {
    width: 32px;
    height: 32px;
    overflow: visible !important;
  }

  & svg path {
    stroke: rgba(255, 255, 255, 0.5);
    transition-property: stroke, filter;
    transition-duration: 140ms;
  }

  &:hover svg path {
    stroke: rgba(255, 255, 255, 1);
    filter: drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.6));
  }

  &.hide svg path {
    stroke: rgba(255, 255, 255, 0);
    transition: stroke 300ms;
  }

  &.hide {
    pointer-events: none;
  }
`

const ExitButton = styled(OverlayButton)`
  left: 28px;
  top: 28px;
`

const InfoButton = styled(OverlayButton)`
  right: 28px;
  top: 28px;
`

const NavigationButton = styled(OverlayButton)<{ align: 'left' | 'right' }>`
  height: 80%;
  width: 20%;
  top: 10%;

  ${({ align: float }) => (float == 'left' ? 'left: 0;' : null)}
  ${({ align: float }) => (float == 'right' ? 'right: 0;' : null)}

  & svg {
    margin: auto;
    width: 48px;
    height: 64px;
  }
`

type PresentNavigationOverlayProps = {
  children?: React.ReactNode | ((showControls: () => void) => React.ReactNode)
  dispatchMedia: React.Dispatch<GalleryAction>
  disableSaveCloseInHistory?: boolean
  onShowInfo?(): void
}

const PresentNavigationOverlay = ({
  children,
  dispatchMedia,
  disableSaveCloseInHistory,
  onShowInfo,
}: PresentNavigationOverlayProps) => {
  const { t } = useTranslation()
  const [hide, setHide] = useState(true)
  const hideTimer = useRef<number | null>(null)

  const showControls = useCallback(() => {
    setHide(false)

    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
    }

    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null
      setHide(true)
    }, 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimer.current !== null) {
        window.clearTimeout(hideTimer.current)
      }
    }
  }, [])

  const childContent =
    typeof children === 'function' ? children(showControls) : children

  return (
    <StyledOverlayContainer
      data-testid="present-overlay"
      onMouseMove={showControls}
    >
      {childContent}
      <NavigationButton
        aria-label="Previous image"
        className={hide ? 'hide' : undefined}
        align="left"
        onClick={event => {
          event.stopPropagation()
          dispatchMedia({ type: 'previousImage' })
        }}
      >
        <PrevIcon />
      </NavigationButton>
      <NavigationButton
        aria-label="Next image"
        className={hide ? 'hide' : undefined}
        align="right"
        onClick={event => {
          event.stopPropagation()
          dispatchMedia({ type: 'nextImage' })
        }}
      >
        <NextIcon />
      </NavigationButton>
      <ExitButton
        aria-label="Exit presentation mode"
        className={hide ? 'hide' : undefined}
        onClick={event => {
          event.stopPropagation()
          if (disableSaveCloseInHistory === true) {
            dispatchMedia({ type: 'closePresentMode' })
          } else {
            closePresentModeAction({ dispatchMedia })
          }
        }}
      >
        <ExitIcon />
      </ExitButton>
      {onShowInfo && (
        <InfoButton
          aria-label={t('photos_page.open_details', 'Open photo details')}
          className={hide ? 'hide' : undefined}
          onClick={event => {
            event.stopPropagation()
            onShowInfo()
          }}
        >
          <InfoIcon />
        </InfoButton>
      )}
    </StyledOverlayContainer>
  )
}

export default PresentNavigationOverlay
