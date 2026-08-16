import { MockedProvider } from '@apollo/client/testing'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import simplifiedChinese from '../../extractedTranslations/zh-CN/translation.json'
import * as authentication from '../../helpers/authentication'
import AlbumTitle, { ALBUM_PATH_QUERY } from './AlbumTitle'
import { MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY } from './mobileAlbumContextBarPreferences'

vi.mock('../../helpers/authentication.ts')

const authToken = vi.mocked(authentication.authToken)

beforeEach(() => {
  authToken.mockReset()
  window.localStorage.clear()
})

test('allows the album header to grow when breadcrumb text wraps', () => {
  render(
    <MemoryRouter>
      <MockedProvider mocks={[]}>
        <AlbumTitle
          album={{ id: '3', title: 'A very long album title' }}
          disableLink={false}
        />
      </MockedProvider>
    </MemoryRouter>
  )

  const albumHeader = screen.getByRole('heading').parentElement?.parentElement

  expect(albumHeader).toHaveClass('min-h-[3.5rem]')
  expect(albumHeader).not.toHaveClass('h-14')
})

test('links back to the immediate parent album', async () => {
  authToken.mockReturnValue('token-here')

  render(
    <MemoryRouter>
      <MockedProvider
        addTypename={false}
        mocks={[
          {
            request: {
              query: ALBUM_PATH_QUERY,
              variables: { id: '3' },
            },
            result: {
              data: {
                album: {
                  id: '3',
                  path: [
                    { id: '2', title: 'Immediate parent' },
                    { id: '1', title: 'Root album' },
                  ],
                },
              },
            },
          },
        ]}
      >
        <AlbumTitle album={{ id: '3', title: 'Child' }} disableLink={true} />
      </MockedProvider>
    </MemoryRouter>
  )

  const backLink = await screen.findByRole('link', {
    name: 'Back to parent album',
  })

  expect(backLink).toHaveAttribute('href', '/album/2')
  expect(backLink).toHaveClass('px-0', 'py-0')
  expect(backLink).not.toHaveClass('px-6', 'py-0.5')

  expect(
    screen.getAllByRole('link', { name: 'Back to parent album' })
  ).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Album options' })).toHaveLength(
    1
  )

  const contextBar = screen.getByTestId('album-context-bar')
  expect(contextBar).toHaveAttribute('data-handedness', 'right')
  expect(
    Array.from(contextBar.children, child =>
      child.getAttribute('data-context-part')
    )
  ).toEqual(['content', 'back', 'options'])

  const iconPaths = Array.from(backLink.querySelectorAll('svg path'), path =>
    path.getAttribute('d')
  )
  expect(iconPaths).toEqual(['M20 12H5', 'M12 19l-7-7 7-7'])
})

test('mirrors album actions to the left for the saved left-hand layout', async () => {
  authToken.mockReturnValue('token-here')
  window.localStorage.setItem(MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY, 'left')

  render(
    <MemoryRouter>
      <MockedProvider
        addTypename={false}
        mocks={[
          {
            request: {
              query: ALBUM_PATH_QUERY,
              variables: { id: '3' },
            },
            result: {
              data: {
                album: {
                  id: '3',
                  path: [{ id: '2', title: 'Immediate parent' }],
                },
              },
            },
          },
        ]}
      >
        <AlbumTitle album={{ id: '3', title: 'Child' }} disableLink={true} />
      </MockedProvider>
    </MemoryRouter>
  )

  await screen.findByRole('link', { name: 'Back to parent album' })

  const contextBar = screen.getByTestId('album-context-bar')
  expect(contextBar).toHaveAttribute('data-handedness', 'left')
  expect(
    Array.from(contextBar.children, child =>
      child.getAttribute('data-context-part')
    )
  ).toEqual(['options', 'back', 'content'])
})

test('links a root album back to the albums page', async () => {
  authToken.mockReturnValue('token-here')

  render(
    <MemoryRouter>
      <MockedProvider
        addTypename={false}
        mocks={[
          {
            request: {
              query: ALBUM_PATH_QUERY,
              variables: { id: '3' },
            },
            result: {
              data: {
                album: {
                  id: '3',
                  path: [],
                },
              },
            },
          },
        ]}
      >
        <AlbumTitle album={{ id: '3', title: 'Root' }} disableLink={true} />
      </MockedProvider>
    </MemoryRouter>
  )

  expect(
    await screen.findByRole('link', { name: 'Back to albums' })
  ).toHaveAttribute('href', '/albums')
  expect(screen.getAllByRole('link', { name: 'Back to albums' })).toHaveLength(
    1
  )
})

test('places personal curation with the mirrored mobile actions', async () => {
  authToken.mockReturnValue('token-here')
  window.localStorage.setItem(MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY, 'left')

  render(
    <MemoryRouter>
      <MockedProvider
        addTypename={false}
        mocks={[
          {
            request: {
              query: ALBUM_PATH_QUERY,
              variables: { id: '3' },
            },
            result: {
              data: {
                album: {
                  id: '3',
                  path: [{ id: '2', title: 'Immediate parent' }],
                },
              },
            },
          },
        ]}
      >
        <AlbumTitle
          album={{
            id: '3',
            title: 'Curated child',
            viewerState: {
              featured: true,
              viewCount: 5,
              lastViewedAt: '2026-08-16T12:00:00Z',
            },
          }}
          disableLink={true}
        />
      </MockedProvider>
    </MemoryRouter>
  )

  await screen.findByRole('link', { name: 'Back to parent album' })
  expect(
    screen.getByRole('button', { name: 'Remove album from featured' })
  ).toHaveAttribute('aria-pressed', 'true')

  const contextBar = screen.getByTestId('album-context-bar')
  expect(
    Array.from(contextBar.children, child =>
      child.getAttribute('data-context-part')
    )
  ).toEqual(['options', 'featured', 'back', 'content'])
})

test('renders the customized album context bar in Simplified Chinese', async () => {
  authToken.mockReturnValue('token-here')
  const instance = i18next.createInstance()
  await instance.init({
    lng: 'zh-CN',
    fallbackLng: false,
    returnEmptyString: false,
    resources: { 'zh-CN': { translation: simplifiedChinese } },
  })

  render(
    <I18nextProvider i18n={instance}>
      <MemoryRouter>
        <MockedProvider
          addTypename={false}
          mocks={[
            {
              request: {
                query: ALBUM_PATH_QUERY,
                variables: { id: '3' },
              },
              result: {
                data: {
                  album: {
                    id: '3',
                    path: [{ id: '2', title: '上一级' }],
                  },
                },
              },
            },
          ]}
        >
          <AlbumTitle album={{ id: '3', title: '当前相册' }} disableLink />
        </MockedProvider>
      </MemoryRouter>
    </I18nextProvider>
  )

  expect(
    await screen.findByRole('link', { name: '返回上一级相册' })
  ).toBeVisible()
  expect(screen.getByRole('navigation', { name: '相册路径' })).toBeVisible()
  expect(screen.getByRole('button', { name: '相册选项' })).toBeVisible()
})
