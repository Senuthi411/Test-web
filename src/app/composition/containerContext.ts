import { createContext, useContext } from 'react'
import type { AppContainer } from './container'

export const ContainerContext = createContext<AppContainer | null>(null)

/** Access ports and configuration. Components never construct adapters themselves. */
export function useContainer(): AppContainer {
  const container = useContext(ContainerContext)
  if (!container) throw new Error('useContainer must be used inside <AppProviders>.')
  return container
}
