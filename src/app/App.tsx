import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import type { AppContainer } from './composition/container'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

export function App({ container }: { container: AppContainer }) {
  const [router] = useState(() => createBrowserRouter(createAppRoutes()))
  return (
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
