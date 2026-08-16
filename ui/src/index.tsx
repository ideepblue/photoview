import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import client from './apolloClient'
import { ApolloProvider } from '@apollo/client'
import { BrowserRouter as Router } from 'react-router-dom'
import { setupLocalization } from './localization'
import { updateTheme } from './theme'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'
import {
  clearPreloadRecovery,
  recoverFromPreloadError,
} from './pwaUpdateRecovery'

import './index.css'
import { SidebarProvider } from './components/sidebar/Sidebar'

updateTheme()
setupLocalization()

window.addEventListener('vite:preloadError', event => {
  event.preventDefault()
  recoverFromPreloadError(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
    window.sessionStorage,
    () => window.location.reload()
  )
})

window.addEventListener(
  'load',
  () => {
    window.setTimeout(() => clearPreloadRecovery(window.sessionStorage), 10000)
  },
  { once: true }
)

const Main = () => (
  <ApolloProvider client={client}>
    <Router basename={import.meta.env.BASE_URL}>
      <SidebarProvider>
        <App />
      </SidebarProvider>
    </Router>
  </ApolloProvider>
)

const root = createRoot(document.getElementById('root')!)
root.render(<Main />)

serviceWorkerRegistration.register()
