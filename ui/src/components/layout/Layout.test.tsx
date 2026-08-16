import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import Layout from './Layout'

const setStandaloneDisplay = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches }),
  })
}

const pull = (target: HTMLElement, distance: number) => {
  fireEvent.touchStart(target, {
    touches: [{ clientX: 20, clientY: 10 }],
  })
  fireEvent.touchMove(target, {
    touches: [{ clientX: 22, clientY: 10 + distance }],
  })
  fireEvent.touchEnd(target)
}

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  setStandaloneDisplay(false)
})

test('Layout component', () => {
  render(
    <Layout title="Test title">
      <p>layout_content</p>
    </Layout>
  )

  expect(screen.getByTestId('Layout')).toBeInTheDocument()
  expect(screen.getByText('layout_content')).toBeInTheDocument()
})

test('reserves mobile scroll space below all layout content', () => {
  render(
    <Layout title="Gallery">
      <div>Last gallery item</div>
    </Layout>
  )

  const content = document.getElementById('layout-content')

  expect(content).toHaveClass('mobile-main-menu-clearance')
  expect(content).toContainElement(screen.getByText('Last gallery item'))
})

test('refreshes after a standalone top-of-page downward pull', () => {
  const onRefresh = vi.fn()
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  setStandaloneDisplay(true)

  render(
    <Layout title="Gallery" onRefresh={onRefresh}>
      <div>Gallery</div>
    </Layout>
  )

  const layout = screen.getByTestId('Layout')
  pull(layout, 90)

  expect(onRefresh).toHaveBeenCalledTimes(1)
})

test('does not refresh below the pull threshold', () => {
  const onRefresh = vi.fn()
  setStandaloneDisplay(true)

  render(
    <Layout title="Gallery" onRefresh={onRefresh}>
      <div>Gallery</div>
    </Layout>
  )

  pull(screen.getByTestId('Layout'), 40)

  expect(onRefresh).not.toHaveBeenCalled()
})

test('does not refresh outside standalone display mode', () => {
  const onRefresh = vi.fn()
  setStandaloneDisplay(false)

  render(
    <Layout title="Gallery" onRefresh={onRefresh}>
      <div>Gallery</div>
    </Layout>
  )

  pull(screen.getByTestId('Layout'), 90)

  expect(onRefresh).not.toHaveBeenCalled()
})

test('does not refresh from an explicitly disabled surface', () => {
  const onRefresh = vi.fn()
  setStandaloneDisplay(true)

  render(
    <Layout title="Gallery" onRefresh={onRefresh}>
      <div data-disable-pull-to-refresh>Fullscreen viewer</div>
    </Layout>
  )

  pull(screen.getByText('Fullscreen viewer'), 90)

  expect(onRefresh).not.toHaveBeenCalled()
})
