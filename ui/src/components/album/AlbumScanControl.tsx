import { gql, useMutation } from '@apollo/client'
import { Popover } from '@headlessui/react'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useIsAdmin } from '../routes/AuthorizedRoute'
import Modal from '../../primitives/Modal'
import Checkbox from '../../primitives/form/Checkbox'
import { Button, buttonStyles } from '../../primitives/form/Input'
import { tailwindClassNames } from '../../helpers/utils'
import {
  scanAlbumMutation,
  scanAlbumMutationVariables,
} from './__generated__/scanAlbumMutation'
import { SCANNER_COMPLETE_EVENT } from './scannerEvents'

export const SCAN_ALBUM_MUTATION = gql`
  mutation scanAlbumMutation(
    $albumId: ID!
    $recursive: Boolean!
    $forceRefresh: Boolean!
  ) {
    scanAlbum(
      albumId: $albumId
      recursive: $recursive
      forceRefresh: $forceRefresh
    ) {
      success
      message
    }
  }
`

type AlbumScanControlProps = {
  albumId: string
  onScanComplete(): Promise<unknown> | unknown
}

type ScanStatus = {
  kind: 'pending' | 'success' | 'error'
  message: string
}

const AlbumScanControl = ({
  albumId,
  onScanComplete,
}: AlbumScanControlProps) => {
  const isAdmin = useIsAdmin()
  const { t } = useTranslation()
  const [recursive, setRecursive] = useState(false)
  const [forceRefresh, setForceRefresh] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [status, setStatus] = useState<ScanStatus | null>(null)
  const [scanAlbum, { loading }] = useMutation<
    scanAlbumMutation,
    scanAlbumMutationVariables
  >(SCAN_ALBUM_MUTATION)
  const pendingScan = useRef(false)
  const completionSeen = useRef(false)

  useEffect(() => {
    const handleScannerComplete = async () => {
      if (!pendingScan.current) return

      pendingScan.current = false
      completionSeen.current = true
      try {
        await onScanComplete()
        setStatus({
          kind: 'success',
          message: t('album_scan.complete', 'Scan complete. Album refreshed.'),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({
          kind: 'error',
          message: t(
            'album_scan.refresh_failed',
            'Scan completed, but the album could not refresh: {{message}}',
            { message }
          ),
        })
      }
    }

    window.addEventListener(SCANNER_COMPLETE_EVENT, handleScannerComplete)
    return () =>
      window.removeEventListener(SCANNER_COMPLETE_EVENT, handleScannerComplete)
  }, [onScanComplete, t])

  const resetChoices = () => {
    setRecursive(false)
    setForceRefresh(false)
    setConfirmOpen(false)
  }

  const runScan = async (close: () => void) => {
    setConfirmOpen(false)
    pendingScan.current = true
    completionSeen.current = false
    setStatus({
      kind: 'pending',
      message: t('album_scan.scanning', 'Scanning and filling cache…'),
    })
    close()

    try {
      const result = await scanAlbum({
        variables: {
          albumId,
          recursive,
          forceRefresh,
        },
      })
      const scannerResult = result.data?.scanAlbum
      if (!scannerResult?.success) {
        throw new Error(
          scannerResult?.message ||
            t('album_scan.unknown_error', 'The scanner rejected the request')
        )
      }

      if (!completionSeen.current) {
        setStatus({
          kind: 'pending',
          message: t('album_scan.queued', 'Scan queued successfully'),
        })
      }
    } catch (error) {
      if (completionSeen.current) return

      pendingScan.current = false
      const message = error instanceof Error ? error.message : String(error)
      setStatus({
        kind: 'error',
        message: t(
          'album_scan.start_failed',
          'Could not start scan: {{message}}',
          { message }
        ),
      })
    }
  }

  if (!isAdmin) return null

  return (
    <div className="w-full sm:w-auto">
      <Popover className="relative">
        {({ open, close }) => (
          <>
            <Popover.Button
              className={tailwindClassNames(
                buttonStyles({}),
                'h-11 px-3 flex items-center gap-2'
              )}
              onClick={() => {
                if (!open) resetChoices()
              }}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 11a8 8 0 1 0-2.34 5.66" />
                <path d="M20 4v7h-7" />
              </svg>
              {t('album_scan.action', 'Scan and cache')}
            </Popover.Button>

            <Popover.Panel className="absolute left-0 z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded border border-gray-200 bg-white p-4 shadow-lg dark:border-dark-input-border dark:bg-dark-bg">
              <fieldset className="space-y-3">
                <legend className="mb-2 font-semibold">
                  {t('album_scan.scope', 'Scan scope')}
                </legend>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="album-scan-scope"
                    checked={!recursive}
                    onChange={() => setRecursive(false)}
                    className="mt-1"
                  />
                  <span>
                    {t('album_scan.current_only', 'Current album only')}
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="album-scan-scope"
                    checked={recursive}
                    onChange={() => setRecursive(true)}
                    className="mt-1"
                  />
                  <span>
                    {t(
                      'album_scan.recursive',
                      'Current album and all child albums'
                    )}
                  </span>
                </label>
              </fieldset>

              <div className="mt-4 border-t border-gray-200 pt-4 dark:border-dark-input-border">
                <Checkbox
                  label={t(
                    'album_scan.force_refresh',
                    'Force rebuild existing thumbnails'
                  )}
                  checked={forceRefresh}
                  onChange={event => setForceRefresh(event.target.checked)}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t(
                    'album_scan.force_hint',
                    'Off by default. Normal scans keep healthy cached thumbnails.'
                  )}
                </p>
              </div>

              <Button
                type="button"
                className="mt-4 h-10 w-full"
                variant="positive"
                disabled={loading}
                onClick={() => {
                  if (recursive && forceRefresh) {
                    setConfirmOpen(true)
                  } else {
                    void runScan(close)
                  }
                }}
              >
                {loading
                  ? t('album_scan.starting', 'Starting…')
                  : t('album_scan.start', 'Start scan')}
              </Button>
            </Popover.Panel>

            <Modal
              open={confirmOpen}
              onClose={() => setConfirmOpen(false)}
              title={t(
                'album_scan.confirm_title',
                'Rebuild thumbnails recursively?'
              )}
              description={t(
                'album_scan.confirm_description',
                'This rebuilds existing thumbnails in the selected album and every child album. It can take a long time.'
              )}
              actions={[
                {
                  key: 'cancel',
                  label: t('general.action.cancel', 'Cancel'),
                  onClick: () => setConfirmOpen(false),
                },
                {
                  key: 'continue',
                  label: t('album_scan.continue', 'Continue'),
                  variant: 'positive',
                  onClick: () => void runScan(close),
                },
              ]}
            />
          </>
        )}
      </Popover>

      {status && (
        <p
          role="status"
          aria-live="polite"
          className={tailwindClassNames(
            'mt-2 max-w-xs text-sm',
            status.kind === 'error' && 'text-red-600',
            status.kind === 'success' && 'text-green-600',
            status.kind === 'pending' && 'text-gray-600 dark:text-gray-300'
          )}
        >
          {status.message}
        </p>
      )}
    </div>
  )
}

export default AlbumScanControl
