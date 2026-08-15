import React, { useState, useRef, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import { closePresentModeAction, GalleryAction } from '../mediaGalleryReducer'
import { useTranslation } from 'react-i18next'

import ExitIcon from './icons/Exit'
import InfoIcon from './icons/Info'
import NextIcon from './icons/Next'
import PrevIcon from './icons/Previous'
import {
  getPresentViewPreferences,
  PresentViewPreferences,
  setPresentViewPreferences,
} from './presentViewPreferences'

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

const SettingsButton = styled(OverlayButton)`
  right: 28px;
  bottom: max(28px, env(safe-area-inset-bottom));
`

const ViewerMetadata = styled.div`
  position: absolute;
  z-index: 2;
  top: max(20px, env(safe-area-inset-top));
  left: 50%;
  width: max-content;
  max-width: calc(100vw - 180px);
  transform: translateX(-50%);
  text-align: center;
  line-height: 1.25;
  pointer-events: none;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95), 0 0 12px rgba(0, 0, 0, 0.65);
`

const PositionText = styled.div`
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
`

const FilenameText = styled.div`
  margin-top: 3px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const SettingsPopover = styled.div`
  position: absolute;
  z-index: 3;
  right: 28px;
  bottom: max(96px, calc(env(safe-area-inset-bottom) + 68px));
  min-width: 184px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  background: rgba(18, 18, 20, 0.88);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(14px);
`

const SettingsTitle = styled.div`
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`

const SettingsOption = styled.label`
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 10px;
  color: white;
  cursor: pointer;
  font-size: 14px;

  & input {
    width: 18px;
    height: 18px;
    accent-color: #fff;
  }
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
  activeIndex?: number
  mediaCount?: number
  filename?: string
  onShowInfo?(): void
}

const PresentNavigationOverlay = ({
  children,
  dispatchMedia,
  disableSaveCloseInHistory,
  activeIndex,
  mediaCount,
  filename,
  onShowInfo,
}: PresentNavigationOverlayProps) => {
  const { t } = useTranslation()
  const [hide, setHide] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [preferences, setPreferences] = useState(getPresentViewPreferences)
  const hideTimer = useRef<number | null>(null)

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null
      setHide(true)
    }, 2000)
  }, [clearHideTimer])

  const showControls = useCallback(() => {
    setHide(false)

    if (settingsOpen) {
      clearHideTimer()
    } else {
      scheduleHide()
    }
  }, [clearHideTimer, scheduleHide, settingsOpen])

  useEffect(() => {
    return clearHideTimer
  }, [clearHideTimer])

  const updatePreference = (
    key: keyof PresentViewPreferences,
    value: boolean
  ) => {
    setPreferences(current => {
      const next = { ...current, [key]: value }
      setPresentViewPreferences(next)
      return next
    })
  }

  const childContent =
    typeof children === 'function' ? children(showControls) : children

  return (
    <StyledOverlayContainer
      data-testid="present-overlay"
      onMouseMove={showControls}
    >
      {childContent}
      {(preferences.showPosition || preferences.showFilename) &&
        mediaCount !== undefined &&
        mediaCount > 0 && (
          <ViewerMetadata aria-live="polite">
            {preferences.showPosition && activeIndex !== undefined && (
              <PositionText>{`${
                activeIndex + 1
              } / ${mediaCount}`}</PositionText>
            )}
            {preferences.showFilename && filename && (
              <FilenameText title={filename}>{filename}</FilenameText>
            )}
          </ViewerMetadata>
        )}
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
      <SettingsButton
        aria-label={t(
          'present_view.display_options.open',
          'Fullscreen display options'
        )}
        aria-expanded={settingsOpen}
        className={hide ? 'hide' : undefined}
        onClick={event => {
          event.stopPropagation()

          if (settingsOpen) {
            setSettingsOpen(false)
            scheduleHide()
          } else {
            clearHideTimer()
            setHide(false)
            setSettingsOpen(true)
          }
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M6 9h20M6 16h20M6 23h20" />
          <path d="M12 6v6M21 13v6M15 20v6" />
        </svg>
      </SettingsButton>
      {settingsOpen && (
        <SettingsPopover
          role="group"
          aria-label={t(
            'present_view.display_options.title',
            'Fullscreen display'
          )}
          onClick={event => event.stopPropagation()}
        >
          <SettingsTitle>
            {t('present_view.display_options.title', 'Fullscreen display')}
          </SettingsTitle>
          <SettingsOption>
            <input
              type="checkbox"
              checked={preferences.showPosition}
              onChange={event =>
                updatePreference('showPosition', event.target.checked)
              }
            />
            {t('present_view.display_options.position', 'Show position')}
          </SettingsOption>
          <SettingsOption>
            <input
              type="checkbox"
              checked={preferences.showFilename}
              onChange={event =>
                updatePreference('showFilename', event.target.checked)
              }
            />
            {t('present_view.display_options.filename', 'Show filename')}
          </SettingsOption>
        </SettingsPopover>
      )}
    </StyledOverlayContainer>
  )
}

export default PresentNavigationOverlay
