import { MockedProvider } from '@apollo/client/testing'
import { render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import React from 'react'
import { I18nextProvider } from 'react-i18next'
import { OrderDirection } from '../../__generated__/globalTypes'
import simplifiedChinese from '../../extractedTranslations/zh-CN/translation.json'
import AlbumFeaturedButton from './AlbumFeaturedButton'
import AlbumFilter from './AlbumFilter'

const renderInSimplifiedChinese = async (element: React.ReactElement) => {
  const instance = i18next.createInstance()
  await instance.init({
    lng: 'zh-CN',
    fallbackLng: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    resources: {
      'zh-CN': { translation: simplifiedChinese },
    },
  })

  return render(<I18nextProvider i18n={instance}>{element}</I18nextProvider>)
}

test('renders album engagement controls in Simplified Chinese', async () => {
  await renderInSimplifiedChinese(
    <AlbumFilter
      onlyFavorites={false}
      albumEngagement={{
        viewStatus: 'all',
        setViewStatus: vi.fn(),
        onlyFeatured: false,
        setOnlyFeatured: vi.fn(),
        ordering: {
          orderBy: 'title',
          orderDirection: OrderDirection.ASC,
        },
        setOrdering: vi.fn(),
      }}
    />
  )

  const viewStatus = screen.getByRole('group', { name: '相册浏览状态' })
  expect(viewStatus).toBeVisible()
  expect(screen.getByRole('button', { name: '全部相册' })).toBeVisible()
  expect(screen.getByRole('button', { name: '已看相册' })).toBeVisible()
  expect(screen.getByRole('button', { name: '未看相册' })).toBeVisible()
  expect(within(viewStatus).getByText('全部')).toBeVisible()
  expect(within(viewStatus).getByText('已看')).toBeVisible()
  expect(within(viewStatus).getByText('未看')).toBeVisible()
  expect(screen.getByRole('checkbox', { name: '只显示精选相册' })).toBeVisible()
  expect(screen.getByRole('combobox', { name: '相册排序' })).toHaveTextContent(
    '浏览次数'
  )
  expect(screen.getByRole('combobox', { name: '相册排序' })).toHaveTextContent(
    '最近浏览'
  )
})

test('renders the personal featured action in Simplified Chinese', async () => {
  await renderInSimplifiedChinese(
    <MockedProvider addTypename={false}>
      <AlbumFeaturedButton albumId="album-1" featured={false} />
    </MockedProvider>
  )

  expect(screen.getByRole('button', { name: '添加到精选相册' })).toBeVisible()
})
