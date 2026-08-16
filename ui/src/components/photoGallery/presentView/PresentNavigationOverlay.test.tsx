import React from 'react'
import PresentNavigationOverlay from './PresentNavigationOverlay'
import { fireEvent, render, screen, act } from '@testing-library/react'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import simplifiedChinese from '../../../extractedTranslations/zh-CN/translation.json'

vi.useFakeTimers()

describe('PresentNavigationOverlay component', () => {
  test('simple render', () => {
    const dispatchMedia = vi.fn()
    const showInfo = vi.fn()
    render(
      <PresentNavigationOverlay
        dispatchMedia={dispatchMedia}
        onShowInfo={showInfo}
      />
    )

    expect(screen.getByLabelText('Previous image')).toBeInTheDocument()
    expect(screen.getByLabelText('Next image')).toBeInTheDocument()
    expect(screen.getByLabelText('Exit presentation mode')).toBeInTheDocument()
    expect(screen.getByLabelText('Open photo details')).toBeInTheDocument()
    expect(screen.getByLabelText('Exit presentation mode')).toHaveClass('hide')
    expect(screen.getByLabelText('Open photo details')).toHaveClass('hide')
  })

  test('click buttons', () => {
    const dispatchMedia = vi.fn()
    render(<PresentNavigationOverlay dispatchMedia={dispatchMedia} />)

    expect(dispatchMedia).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Next image'))
    expect(dispatchMedia).lastCalledWith({ type: 'nextImage' })

    fireEvent.click(screen.getByLabelText('Previous image'))
    expect(dispatchMedia).lastCalledWith({ type: 'previousImage' })
  })

  test('mouse move, show and hide', () => {
    const dispatchMedia = vi.fn()
    const { container } = render(
      <PresentNavigationOverlay
        dispatchMedia={dispatchMedia}
        onShowInfo={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Next image')).toHaveClass('hide')
    expect(screen.getByLabelText('Open photo details')).toHaveClass('hide')

    fireEvent.mouseMove(container.firstChild!)
    expect(screen.getByLabelText('Next image')).not.toHaveClass('hide')
    expect(screen.getByLabelText('Open photo details')).not.toHaveClass('hide')

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByLabelText('Next image')).toHaveClass('hide')
    expect(screen.getByLabelText('Open photo details')).toHaveClass('hide')
  })

  test('a light tap reveals controls and info uses the supplied callback', () => {
    const dispatchMedia = vi.fn()
    const showInfo = vi.fn()

    render(
      <PresentNavigationOverlay
        dispatchMedia={dispatchMedia}
        onShowInfo={showInfo}
      >
        {showControls => <button onClick={showControls}>Photo surface</button>}
      </PresentNavigationOverlay>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Photo surface' }))

    expect(screen.getByLabelText('Exit presentation mode')).not.toHaveClass(
      'hide'
    )
    expect(screen.getByLabelText('Open photo details')).not.toHaveClass('hide')

    fireEvent.click(screen.getByLabelText('Open photo details'))

    expect(showInfo).toHaveBeenCalledTimes(1)
    expect(dispatchMedia).not.toHaveBeenCalled()
  })

  test('renders customized fullscreen controls in Simplified Chinese', async () => {
    const instance = i18next.createInstance()
    await instance.init({
      lng: 'zh-CN',
      fallbackLng: false,
      returnEmptyString: false,
      resources: { 'zh-CN': { translation: simplifiedChinese } },
    })

    render(
      <I18nextProvider i18n={instance}>
        <PresentNavigationOverlay
          dispatchMedia={vi.fn()}
          onShowInfo={vi.fn()}
        />
      </I18nextProvider>
    )

    expect(screen.getByRole('button', { name: '上一张图片' })).toBeVisible()
    expect(screen.getByRole('button', { name: '下一张图片' })).toBeVisible()
    expect(screen.getByRole('button', { name: '退出全屏浏览' })).toBeVisible()
    expect(screen.getByRole('button', { name: '打开照片详情' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '全屏显示设置' }))

    expect(screen.getByRole('group', { name: '全屏显示' })).toBeVisible()
    expect(screen.getByText('显示位置')).toBeVisible()
    expect(screen.getByText('显示文件名')).toBeVisible()
  })
})
