import React, { useEffect } from 'react'
import styled from 'styled-components'
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

type PresentMediaProps = {
  media: PresentMediaFields
  imageLoaded?(): void
  onViewingActive?(active: boolean): void
}

const PresentMedia = ({
  media,
  imageLoaded,
  onViewingActive,
}: PresentMediaProps) => {
  useEffect(() => () => onViewingActive?.(false), [media.id, onViewingActive])

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
              imageLoaded && imageLoaded()
              onViewingActive?.(true)
            }}
          />
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
