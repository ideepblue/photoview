import { MockedProvider } from '@apollo/client/testing'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import UserPreferences, {
  CHANGE_USER_PREFERENCES,
  MY_USER_PREFERENCES,
} from './UserPreferences'

test('changes the account home page preference', async () => {
  let mutationCalled = false

  render(
    <MockedProvider
      addTypename={false}
      mocks={[
        {
          request: { query: MY_USER_PREFERENCES },
          result: {
            data: {
              myUserPreferences: {
                id: '1',
                language: null,
                homePage: 'albums',
              },
            },
          },
        },
        {
          request: {
            query: CHANGE_USER_PREFERENCES,
            variables: { homePage: 'timeline' },
          },
          result: () => {
            mutationCalled = true
            return {
              data: {
                changeUserPreferences: {
                  id: '1',
                  language: null,
                  homePage: 'timeline',
                },
              },
            }
          },
        },
      ]}
    >
      <UserPreferences />
    </MockedProvider>
  )

  const homePage = await screen.findByLabelText(/Home page/)
  expect(homePage).toHaveValue('albums')

  fireEvent.change(homePage, { target: { value: 'timeline' } })
  await waitFor(() => expect(mutationCalled).toBe(true))
})
