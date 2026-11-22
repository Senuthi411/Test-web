import { createContext, useContext } from 'react'
import type { AnalyticsUseCases } from '../../application/ports'

export interface AnalyticsServices {
  useCases: AnalyticsUseCases
  /** True in fixture mode: screens label data as demonstration data. */
  demo: boolean
}

export const AnalyticsContext = createContext<AnalyticsServices | null>(null)

export function useAnalyticsServices(): AnalyticsServices {
  const services = useContext(AnalyticsContext)
  if (!services) throw new Error('Analytics services are unavailable')
  return services
}
