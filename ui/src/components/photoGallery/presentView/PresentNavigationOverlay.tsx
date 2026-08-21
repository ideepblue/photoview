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
  display: grid;
  width: 48px;
  height: 48px;
  padding: 0;
  place-items: center;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(20, 20, 24, 0.64);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  outline: none;
  cursor: pointer;
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  transition: opacity 180ms ease, transform 180ms ease, background 140ms ease;

  & svg {
    width: 22px;
    height: 22px;
    overflow: visible !important;
  }

  & svg path {
    stroke: currentColor;
  }

  &:hover {
    background: rgba(48, 48, 54, 0.82);
    transform: scale(1.04);
  }

  &:active {
    transform: scale(0.94);
  }

  &.hide {
    opacity: 0;
    pointer-events: none;
    transform: scale(0.88);
  }
`

const ActionRail = styled.div`
  position: absolute;
  z-index: 2;
  right: max(20px, env(safe-area-inset-right));
  bottom: max(20px, env(safe-area-inset-bottom));
  display: flex;
  gap: 10px;
`

const ExitButton = styled(OverlayButton)``
const InfoButton = styled(OverlayButton)``
const SettingsButton = styled(OverlayButton)``

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
  right: max(20px, env(safe-area-inset-right));
  bottom: max(78px, calc(env(safe-area-inset-bottom) + 58px));
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
  position: absolute;
  z-index: 2;
  top: 50%;
  transform: translateY(-50%);

  ${({ align: float }) =>
    float == 'left'
      ? 'left: max(16px, env(safe-area-inset-left));'
      : 'right: max(16px, env(safe-area-inset-right));'}

  &.hide {
    transform: translateY(-50%) scale(0.88);
  }
`

type PresentNavigationOverlayProps = {
  children?:
    | React.ReactNode
    | ((
        showControls: () => void,
        preferences: PresentViewPreferences
      ) => React.ReactNode)
  dispatchMedia: React.Dispatch<GalleryAction>
  disableSaveCloseInHistory?: boolean
  activeIndex?: number
  mediaCount?: number
  filename?: string
  onShowInfo?(): void
  zoomed?: boolean
}

const PresentNavigationOverlay = ({
  children,
  dispatchMedia,
  disableSaveCloseInHistory,
  activeIndex,
  mediaCount,
  filename,
  onShowInfo,
  zoomed = false,
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
    typeof children === 'function'
      ? children(showControls, preferences)
      : children

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
        aria-label={t('present_view.navigation.previous', 'Previous image')}
        className={hide || zoomed ? 'hide' : undefined}
        align="left"
        disabled={zoomed}
        onClick={event => {
          event.stopPropagation()
          dispatchMedia({ type: 'previousImage' })
        }}
      >
        <PrevIcon />
      </NavigationButton>
      <NavigationButton
        aria-label={t('present_view.navigation.next', 'Next image')}
        className={hide || zoomed ? 'hide' : undefined}
        align="right"
        disabled={zoomed}
        onClick={event => {
          event.stopPropagation()
          dispatchMedia({ type: 'nextImage' })
        }}
      >
        <NextIcon />
      </NavigationButton>
      <ActionRail data-testid="present-action-rail">
        <ExitButton
          aria-label={t(
            'present_view.navigation.exit',
            'Exit presentation mode'
          )}
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
      </ActionRail>
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
          <SettingsOption>
            <input
              type="checkbox"
              checked={preferences.loadHighRes}
              onChange={event =>
                updatePreference('loadHighRes', event.target.checked)
              }
            />
            {t(
              'present_view.display_options.high_res',
              'Load high-resolution images'
            )}
          </SettingsOption>
        </SettingsPopover>
      )}
    </StyledOverlayContainer>
  )
}

export default PresentNavigationOverlay
