import React from 'react'
import { render } from '@testing-library/react'

import AlbumBoxes from './AlbumBoxes'

test('uses two portrait columns only below the desktop breakpoint', () => {
  const { container } = render(<AlbumBoxes />)
  const gallery = container.firstElementChild
  const card = gallery?.firstElementChild
  const thumbnail = card?.firstElementChild

  expect(gallery).toHaveClass('grid', 'grid-cols-2', 'xs:block')
  expect(card).toHaveClass('block', 'w-full', 'xs:inline-block', 'xs:w-[220px]')
  expect(thumbnail).toHaveClass('pb-[133.333333%]', 'xs:pb-0', 'xs:h-[220px]')
})
