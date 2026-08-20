import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useTranslation } from 'react-i18next'
import { MediaType } from '../../../__generated__/globalTypes'
import { exhaustiveCheck } from '../../../helpers/utils'
import { ProtectedImage, ProtectedVideo } from '../ProtectedMedia'
import { MediaGalleryFields } from '../__generated__/MediaGalleryFields'

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

const QualityIndicator = styled.span`
  position: absolute;
  z-index: 1;
  top: max(16px, env(safe-area-inset-top));
  left: max(16px, env(safe-area-inset-left));
  width: 10px;
  height: 10px;
  pointer-events: none;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.9));

  & svg {
    display: block;
    width: 100%;
    height: 100%;
  }
`

type PresentMediaProps = {
  media: PresentMediaFields
  imageLoaded?(): void
  onViewingActive?(active: boolean): void
}

type HighResState = 'loading' | 'loaded' | 'unavailable'

const PresentMedia = ({
  media,
  imageLoaded,
  onViewingActive,
}: PresentMediaProps) => {
  const { t } = useTranslation()
  const [highResState, setHighResState] = useState<HighResState>(() =>
    media.highRes?.url ? 'loading' : 'unavailable'
  )
  const reportedHighResRef = useRef(false)

  useEffect(() => {
    reportedHighResRef.current = false
    setHighResState(media.highRes?.url ? 'loading' : 'unavailable')
  }, [media.highRes?.url, media.id])
  useEffect(() => () => onViewingActive?.(false), [media.id, onViewingActive])

  const reportHighResLoaded = useCallback(() => {
    setHighResState('loaded')
    if (reportedHighResRef.current) return

    reportedHighResRef.current = true
    imageLoaded?.()
    onViewingActive?.(true)
  }, [imageLoaded, onViewingActive])

  switch (media.type) {
    case MediaType.Photo:
      return (
        <div>
          <StyledPhoto
            key={`${media.id}-thumb`}
            src={media.thumbnail?.url}
            draggable={false}
            data-testid="present-img-thumbnail"
          />
          <StyledPhoto
            key={`${media.id}-highres`}
            style={{ display: 'none' }}
            src={media.highRes?.url}
            draggable={false}
            data-testid="present-img-highres"
            onLoad={e => {
              const elem = e.target as HTMLImageElement
              elem.style.display = 'initial'
              reportHighResLoaded()
            }}
            onError={() => setHighResState('unavailable')}
          />
          <QualityIndicator
            role="status"
            data-quality={
              highResState === 'loaded'
                ? 'high-res'
                : highResState === 'unavailable'
                ? 'unavailable'
                : 'thumbnail'
            }
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
                : t(
                    'present_view.quality.thumbnail',
                    'Thumbnail preview is displayed'
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
              ) : (
                <path
                  d="M4 1h4v1h2v2h1v4h-1v2H8v1H4v-1H2V8H1V4h1V2h2Z"
                  fill="rgba(224, 184, 96, 0.2)"
                  stroke="rgba(241, 209, 137, 0.78)"
                  strokeDasharray="1 1"
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
