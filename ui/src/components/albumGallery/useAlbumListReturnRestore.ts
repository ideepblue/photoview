import { RefObject, useEffect, useRef, useState } from 'react'
import {
  AlbumListReturnRecord,
  getAlbumListReturnRecord,
} from './albumListReturnContext'

type AlbumListRestoreScrollTargetOptions = {
  scrollY: number
  cardTop?: number
  cardViewportOffset: number
  fallbackScrollY: number
}

export const albumListRestoreScrollTarget = ({
  scrollY,
  cardTop,
  cardViewportOffset,
  fallbackScrollY,
}: AlbumListRestoreScrollTargetOptions) =>
  cardTop === undefined
    ? Math.max(fallbackScrollY, 0)
    : Math.max(scrollY + cardTop - cardViewportOffset, 0)

type UseAlbumListReturnRestoreOptions = {
  parentListKey?: string
  presentationKey?: string
  albumsReady: boolean
  shouldRestore: boolean
  rootRef: RefObject<HTMLElement>
}

const requestFrame = (callback: FrameRequestCallback) =>
  typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(() => callback(Date.now()), 0)

const cancelFrame = (frame: number) => {
  if (typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(frame)
  } else {
    window.clearTimeout(frame)
  }
}

const currentScrollY = () =>
  Math.max(window.scrollY || window.pageYOffset || 0, 0)

export const useAlbumListReturnRestore = ({
  parentListKey,
  presentationKey,
  albumsReady,
  shouldRestore,
  rootRef,
}: UseAlbumListReturnRestoreOptions) => {
  const [restoredAlbum, setRestoredAlbum] = useState<AlbumListReturnRecord>()
  const completedRestoration = useRef<string>()
  const cancelledRestoration = useRef<string>()

  useEffect(() => {
    if (!parentListKey || !presentationKey || !albumsReady || !shouldRestore) {
      return
    }

    const record = getAlbumListReturnRecord(parentListKey)
    if (!record || record.presentationKey !== presentationKey) return

    const restorationKey = [
      parentListKey,
      presentationKey,
      record.albumId,
      record.updatedAt,
    ].join('|')
    if (
      completedRestoration.current === restorationKey ||
      cancelledRestoration.current === restorationKey
    ) {
      return
    }

    let secondFrame: number | undefined
    let resetHighlight: number | undefined
    let cancelled = false
    const cancellationEvents: Array<keyof WindowEventMap> = [
      'scroll',
      'touchstart',
      'pointerdown',
      'wheel',
    ]
    const removeCancellationListeners = () =>
      cancellationEvents.forEach(event =>
        window.removeEventListener(event, cancelRestore)
      )
    const cancelRestore = () => {
      if (cancelled) return
      cancelled = true
      cancelledRestoration.current = restorationKey
      cancelFrame(firstFrame)
      if (secondFrame !== undefined) cancelFrame(secondFrame)
      removeCancellationListeners()
    }

    cancellationEvents.forEach(event =>
      window.addEventListener(event, cancelRestore, { passive: true })
    )

    const firstFrame = requestFrame(() => {
      secondFrame = requestFrame(() => {
        if (cancelled) return

        const card = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>('[data-album-id]') ||
            []
        ).find(element => element.dataset.albumId === record.albumId)
        const cardTop = card?.getBoundingClientRect().top
        const target = albumListRestoreScrollTarget({
          scrollY: currentScrollY(),
          cardTop,
          cardViewportOffset: record.cardViewportOffset,
          fallbackScrollY: record.scrollY,
        })

        completedRestoration.current = restorationKey
        removeCancellationListeners()
        window.scrollTo({ top: target, behavior: 'auto' })

        if (card) {
          setRestoredAlbum(record)
          resetHighlight = window.setTimeout(
            () => setRestoredAlbum(undefined),
            2600
          )
        }
      })
    })

    return () => {
      cancelFrame(firstFrame)
      if (secondFrame !== undefined) cancelFrame(secondFrame)
      if (resetHighlight !== undefined) window.clearTimeout(resetHighlight)
      removeCancellationListeners()
    }
  }, [albumsReady, parentListKey, presentationKey, rootRef, shouldRestore])

  return restoredAlbum
}
