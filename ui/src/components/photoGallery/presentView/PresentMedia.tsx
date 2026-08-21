import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useTranslation } from 'react-i18next'
import { MediaType } from '../../../__generated__/globalTypes'
import { exhaustiveCheck } from '../../../helpers/utils'
import {
  getProtectedUrl,
  ProtectedImage,
  ProtectedVideo,
} from '../ProtectedMedia'
import { MediaGalleryFields } from '../__generated__/MediaGalleryFields'
import { fetchHighResBlob, HighResProgress } from './highResLoader'

export type PresentMediaFields = Pick<
  MediaGalleryFields,
  '__typename' | 'id' | 'title' | 'type' | 'thumbnail' | 'highRes' | 'videoWeb'
>

const StyledPhoto = styled(ProtectedImage)`
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  object-fit: contain;
  object-position: center;
`

const StyledVideo = styled(ProtectedVideo)`
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
`

const QualityIndicator = styled.button`
  position: absolute;
  z-index: 1;
  top: max(16px, env(safe-area-inset-top));
  left: max(16px, env(safe-area-inset-left));
  width: 10px;
  height: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  pointer-events: none;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.9));

  &[data-retry='true'] {
    cursor: pointer;
    pointer-events: auto;
  }

  & svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  @keyframes high-res-loading {
    to {
      transform: rotate(360deg);
    }
  }

  & .high-res-indeterminate {
    transform-origin: center;
    animation: high-res-loading 900ms linear infinite;
  }
`

type PresentMediaProps = {
  media: PresentMediaFields
  imageLoaded?(): void
  onViewingActive?(active: boolean): void
  loadHighRes?: boolean
}

type HighResState = 'disabled' | 'loading' | 'loaded' | 'unavailable'

const PresentMedia = ({
  media,
  imageLoaded,
  onViewingActive,
  loadHighRes = true,
}: PresentMediaProps) => {
  const { t } = useTranslation()
  const [highResState, setHighResState] = useState<HighResState>('loading')
  const [highResProgress, setHighResProgress] = useState<HighResProgress>(null)
  const [highResImageUrl, setHighResImageUrl] = useState<string | null>(null)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const reportedViewingRef = useRef(false)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const releaseObjectUrl = () => {
      if (objectUrlRef.current === null) return
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    const highResUrl = loadHighRes
      ? getProtectedUrl(media.highRes?.url)
      : undefined

    reportedViewingRef.current = false
    releaseObjectUrl()
    setHighResImageUrl(null)

    if (highResUrl === undefined) {
      setHighResState('disabled')
      setHighResProgress(null)
      return releaseObjectUrl
    }

    const controller = new AbortController()
    let active = true
    setHighResState('loading')
    setHighResProgress(null)

    fetchHighResBlob(highResUrl, controller.signal, progress => {
      if (active) setHighResProgress(progress)
    })
      .then(blob => {
        if (!active) return
        const objectUrl = URL.createObjectURL(blob)
        objectUrlRef.current = objectUrl
        setHighResImageUrl(objectUrl)
      })
      .catch(error => {
        if (
          !active ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return
        }
        setHighResState('unavailable')
      })

    return () => {
      active = false
      controller.abort()
      releaseObjectUrl()
    }
  }, [loadHighRes, media.highRes?.url, media.id, retryAttempt])
  useEffect(() => () => onViewingActive?.(false), [media.id, onViewingActive])

  const reportImageVisible = useCallback(() => {
    if (reportedViewingRef.current) return

    reportedViewingRef.current = true
    imageLoaded?.()
    onViewingActive?.(true)
  }, [imageLoaded, onViewingActive])

  const retryHighRes = () => {
    if (highResState !== 'unavailable') return
    setRetryAttempt(attempt => attempt + 1)
  }

  switch (media.type) {
    case MediaType.Photo:
      return (
        <div>
          <StyledPhoto
            key={`${media.id}-thumb`}
            src={media.thumbnail?.url}
            draggable={false}
            data-testid="present-img-thumbnail"
            onLoad={reportImageVisible}
          />
          {highResImageUrl !== null && (
            <StyledPhoto
              key={`${media.id}-highres`}
              style={{ display: 'none' }}
              src={highResImageUrl}
              draggable={false}
              data-testid="present-img-highres"
              onLoad={e => {
                const elem = e.target as HTMLImageElement
                elem.style.display = 'initial'
                setHighResState('loaded')
                reportImageVisible()
              }}
              onError={() => setHighResState('unavailable')}
            />
          )}
          <QualityIndicator
            role="status"
            type="button"
            data-quality={
              highResState === 'loaded'
                ? 'high-res'
                : highResState === 'unavailable'
                ? 'unavailable'
                : highResState === 'disabled'
                ? 'high-res-disabled'
                : 'thumbnail'
            }
            data-progress={
              highResState === 'loading' && highResProgress !== null
                ? Math.round(highResProgress * 100)
                : undefined
            }
            data-retry={highResState === 'unavailable'}
            onClick={retryHighRes}
            aria-label={
              highResState === 'loaded'
                ? t(
                    'present_view.quality.high_res',
                    'High-resolution resource is displayed'
                  )
                : highResState === 'unavailable'
                ? t(
                    'present_view.quality.unavailable',
                    'High-resolution resource is unavailable'
                  )
                : highResState === 'disabled'
                ? t(
                    'present_view.quality.disabled',
                    'High-resolution loading is disabled'
                  )
                : t(
                    highResProgress === null
                      ? 'present_view.quality.loading'
                      : 'present_view.quality.loading_progress',
                    highResProgress === null
                      ? 'High-resolution image is loading'
                      : 'High-resolution image loading ({{progress}}%)',
                    highResProgress === null
                      ? undefined
                      : { progress: Math.round(highResProgress * 100) }
                  )
            }
          >
            <svg aria-hidden="true" viewBox="0 0 12 12">
              {highResState === 'loaded' ? (
                <circle
                  cx="6"
                  cy="6"
                  r="4.5"
                  fill="rgba(91, 224, 178, 0.78)"
                  stroke="rgba(235, 255, 248, 0.9)"
                />
              ) : highResState === 'unavailable' ? (
                <>
                  <circle
                    cx="6"
                    cy="6"
                    r="4.5"
                    fill="rgba(224, 184, 96, 0.2)"
                    stroke="rgba(241, 209, 137, 0.78)"
                  />
                  <path
                    d="m4.3 4.3 3.4 3.4m0-3.4-3.4 3.4"
                    stroke="rgba(241, 209, 137, 0.9)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </>
              ) : highResState === 'disabled' ? (
                <>
                  <rect
                    x="2"
                    y="2"
                    width="3"
                    height="3"
                    fill="rgba(187, 194, 215, 0.82)"
                  />
                  <rect
                    x="7"
                    y="2"
                    width="3"
                    height="3"
                    fill="rgba(187, 194, 215, 0.5)"
                  />
                  <rect
                    x="2"
                    y="7"
                    width="3"
                    height="3"
                    fill="rgba(187, 194, 215, 0.5)"
                  />
                  <rect
                    x="7"
                    y="7"
                    width="3"
                    height="3"
                    fill="rgba(187, 194, 215, 0.82)"
                  />
                </>
              ) : highResProgress === null ? (
                <circle
                  className="high-res-indeterminate"
                  cx="6"
                  cy="6"
                  r="4"
                  fill="none"
                  stroke="rgba(187, 194, 215, 0.86)"
                  strokeWidth="1.5"
                  strokeDasharray="7 5"
                />
              ) : (
                <circle
                  cx="6"
                  cy="6"
                  r="4.5"
                  fill="none"
                  stroke="rgba(187, 194, 215, 0.86)"
                  strokeWidth="1.5"
                  strokeDasharray="28.3"
                  strokeDashoffset={28.3 * (1 - highResProgress)}
                  transform="rotate(-90 6 6)"
                />
              )}
            </svg>
          </QualityIndicator>
        </div>
      )
    case MediaType.Video:
      return (
        <StyledVideo
          media={media}
          data-testid="present-video"
          onPlaying={() => onViewingActive?.(true)}
          onPause={() => onViewingActive?.(false)}
          onEnded={() => onViewingActive?.(false)}
          onWaiting={() => onViewingActive?.(false)}
        />
      )
  }

  exhaustiveCheck(media.type)
}

export default PresentMedia
