import React from 'react'
import { useTranslation } from 'react-i18next'
import { buttonStyles } from '../../primitives/form/Input'
import { tailwindClassNames } from '../../helpers/utils'
import { useMobileAlbumContextBarHandedness } from './mobileAlbumContextBarPreferences'

const MobileAlbumContextBarPreference = () => {
  const { t } = useTranslation()
  const [handedness, setHandedness] = useMobileAlbumContextBarHandedness()

  const choices = [
    {
      value: 'left' as const,
      label: t('album_navigation.handedness.left', 'Left hand'),
    },
    {
      value: 'right' as const,
      label: t('album_navigation.handedness.right', 'Right hand'),
    },
  ]

  return (
    <section aria-labelledby="album-context-handedness-heading">
      <h2
        id="album-context-handedness-heading"
        className="mb-2 text-xl font-semibold"
      >
        {t('album_navigation.handedness.title', 'One-handed album bar')}
      </h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        {t(
          'album_navigation.handedness.description',
          'Choose which side keeps Back and Album options within thumb reach on phones.'
        )}
      </p>
      <div
        role="group"
        aria-label={t(
          'album_navigation.handedness.preferred_hand',
          'Preferred hand'
        )}
        className="grid grid-cols-2 gap-2"
      >
        {choices.map(choice => {
          const selected = handedness === choice.value

          return (
            <button
              key={choice.value}
              type="button"
              aria-pressed={selected}
              className={tailwindClassNames(
                buttonStyles({}),
                'h-11 px-3 py-0 text-sm font-semibold',
                {
                  'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200':
                    selected,
                }
              )}
              onClick={() => setHandedness(choice.value)}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default MobileAlbumContextBarPreference
