import { useState } from 'react'
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router'
import type { AppContainer } from './composition/container'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

export function App({ container }: { container: AppContainer }) {
  // Pages cannot rewrite deep paths to index.html. Hash routes survive refresh
  // while keeping the existing browser-history URLs for local development.
  const [router] = useState(() => {
    const createRouter = import.meta.env.BASE_URL === '/Test-web/' ? createHashRouter : createBrowserRouter
    return createRouter(createAppRoutes())
  })
  return (
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
