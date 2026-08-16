import React from 'react'

import Routes from './Routes'
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as authentication from '../../helpers/authentication'
import { MockedProvider } from '@apollo/client/testing'
import { HOME_PAGE_PREFERENCE } from './Routes'

vi.mock('../../helpers/authentication.ts')

vi.mock('../../Pages/LoginPage/LoginPage.tsx', () => () => (
  <div>mocked login page</div>
))
vi.mock('../../Pages/AllAlbumsPage/AlbumsPage.tsx', () => ({
  default: () => <div>mocked albums page</div>,
}))
vi.mock('../../Pages/TimelinePage/TimelinePage.tsx', () => ({
  default: () => <div>mocked timeline page</div>,
}))

const authToken = vi.mocked(authentication.authToken)

describe('routes', () => {
  test('authorized root path defaults to the albums page', async () => {
    authToken.mockReturnValue('token-here')

    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <MemoryRouter initialEntries={['/']}>
          <Routes />
        </MemoryRouter>
      </MockedProvider>
    )

    expect(await screen.findByText('mocked albums page')).toBeInTheDocument()
  })

  test('authorized root path follows the timeline preference', async () => {
    authToken.mockReturnValue('token-here')

    render(
      <MockedProvider
        addTypename={false}
        mocks={[
          {
            request: { query: HOME_PAGE_PREFERENCE },
            result: {
              data: {
                myUserPreferences: { id: '1', homePage: 'timeline' },
              },
            },
          },
        ]}
      >
        <MemoryRouter initialEntries={['/']}>
          <Routes />
        </MemoryRouter>
      </MockedProvider>
    )

    expect(await screen.findByText('mocked timeline page')).toBeInTheDocument()
  })

  // vitest does not support this yet
  // https://github.com/vitest-dev/vitest/issues/960
  test.skip('unauthorized root path should navigate to login page', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes />
      </MemoryRouter>
    )

    await waitForElementToBeRemoved(() =>
      screen.getByText('Loading', { exact: false })
    )

    expect(screen.getByText('mocked login page')).toBeInTheDocument()
  })

  test('invalid page should print a "not found" message', () => {
    render(
      <MemoryRouter initialEntries={['/random_non_existent_page']}>
        <Routes />
      </MemoryRouter>
    )

    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })
})
