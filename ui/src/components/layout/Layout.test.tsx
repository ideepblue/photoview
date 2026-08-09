import React from 'react'
import { render, screen } from '@testing-library/react'

import Layout from './Layout'

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
