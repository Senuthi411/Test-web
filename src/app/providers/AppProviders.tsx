import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { IdentityServicesContext, SessionProvider, useSession } from '@/features/identity'
import { ToastProvider } from '@/shared/components'
import { CaptureContext } from '@/features/capture'
import { ReviewContext } from '@/features/review'
import type { AppContainer } from '../composition/container'
import { ContainerContext } from '../composition/containerContext'
import { createQueryClient, createUnauthorizedSignal, type UnauthorizedSignal } from './queryClient'

/** Ends the session when the query client reports a 401 (the session lives below the client). */
function SessionExpiryBridge({ signal }: { signal: UnauthorizedSignal }) {
  const { expire } = useSession()
  useEffect(() => signal.subscribe(expire), [signal, expire])
  return null
}

export function AppProviders({ container, children }: { container: AppContainer; children: ReactNode }) {
  const [{ queryClient, unauthorized }] = useState(() => {
    const signal = createUnauthorizedSignal()
    return { queryClient: createQueryClient(signal.notify), unauthorized: signal }
  })
  // Cached server data belongs to the signed-in user; drop it when the session ends.
  const clearCache = useCallback(() => queryClient.clear(), [queryClient])

  return (
    <ContainerContext.Provider value={container}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider auth={container.auth} onSessionEnded={clearCache}>
          <SessionExpiryBridge signal={unauthorized} />
          <IdentityServicesContext.Provider value={container.identity}>
            <CaptureContext.Provider value={container.capture}>
              <ReviewContext.Provider value={container.review}>
                <ToastProvider>{children}</ToastProvider>
              </ReviewContext.Provider>
            </CaptureContext.Provider>
          </IdentityServicesContext.Provider>
        </SessionProvider>
      </QueryClientProvider>
    </ContainerContext.Provider>
  )
}
