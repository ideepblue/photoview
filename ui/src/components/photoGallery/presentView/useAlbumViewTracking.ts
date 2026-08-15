import { gql, useMutation } from '@apollo/client'
import { ReactElement, useCallback, useEffect, useRef } from 'react'
import {
  recordAlbumView,
  recordAlbumViewVariables,
} from './__generated__/recordAlbumView'

export const ALBUM_VIEW_THRESHOLD_MS = 2_000
export const ALBUM_VIEW_DEDUPE_MS = 30 * 60 * 1_000

export const RECORD_ALBUM_VIEW_MUTATION = gql`
  mutation recordAlbumView($albumId: ID!, $mediaId: ID!) {
    recordAlbumView(albumID: $albumId, mediaID: $mediaId) {
      featured
      viewCount
      lastViewedAt
    }
  }
`

type UseAlbumViewTrackingProps = {
  albumId?: string
  mediaId: string
  reportedAlbums?: Map<string, number>
}

export const useAlbumViewTracking = ({
  albumId,
  mediaId,
  reportedAlbums,
}: UseAlbumViewTrackingProps) => {
  const fallbackReportedAlbums = useRef(new Map<string, number>())
  const reports = reportedAlbums ?? fallbackReportedAlbums.current
  const timerRef = useRef<number | null>(null)
  const viewingActiveRef = useRef(false)
  const reportingRef = useRef(false)
  const [recordView] = useMutation<recordAlbumView, recordAlbumViewVariables>(
    RECORD_ALBUM_VIEW_MUTATION
  )

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const isRecentlyReported = useCallback(() => {
    if (!albumId) return true
    const lastReportedAt = reports.get(albumId)
    return (
      lastReportedAt !== undefined &&
      Date.now() - lastReportedAt < ALBUM_VIEW_DEDUPE_MS
    )
  }, [albumId, reports])

  const report = useCallback(async () => {
    timerRef.current = null
    if (
      !albumId ||
      !viewingActiveRef.current ||
      document.visibilityState === 'hidden' ||
      reportingRef.current ||
      isRecentlyReported()
    ) {
      return
    }

    reportingRef.current = true
    try {
      await recordView({
        variables: { albumId, mediaId },
        update: (cache, response) => {
          const viewerState = response.data?.recordAlbumView
          if (!viewerState) return

          cache.modify({
            id: cache.identify({ __typename: 'Album', id: albumId }),
            fields: {
              viewerState: () => viewerState,
            },
          })
        },
      })
      reports.set(albumId, Date.now())
    } catch (error) {
      console.warn('Could not record album view', error)
    } finally {
      reportingRef.current = false
    }
  }, [albumId, isRecentlyReported, mediaId, recordView, reports])

  const scheduleReport = useCallback(() => {
    clearTimer()
    if (
      !albumId ||
      !viewingActiveRef.current ||
      document.visibilityState === 'hidden'
    ) {
      return
    }

    timerRef.current = window.setTimeout(report, ALBUM_VIEW_THRESHOLD_MS)
  }, [albumId, clearTimer, report])

  const setViewingActive = useCallback(
    (active: boolean) => {
      viewingActiveRef.current = active
      if (active) {
        scheduleReport()
      } else {
        clearTimer()
      }
    },
    [clearTimer, scheduleReport]
  )

  useEffect(() => {
    clearTimer()
    viewingActiveRef.current = false
  }, [albumId, clearTimer, mediaId])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimer()
      } else if (viewingActiveRef.current) {
        scheduleReport()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [clearTimer, scheduleReport])

  useEffect(() => clearTimer, [clearTimer])

  return setViewingActive
}

type AlbumViewTrackingProps = UseAlbumViewTrackingProps & {
  children(setViewingActive: (active: boolean) => void): ReactElement
}

export const AlbumViewTracking = ({
  children,
  ...trackingProps
}: AlbumViewTrackingProps) => {
  const setViewingActive = useAlbumViewTracking(trackingProps)
  return children(setViewingActive)
}
