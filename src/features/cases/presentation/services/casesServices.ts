import { createContext, useContext } from 'react'
import type { Clock } from '@/shared/utilities/clock'
import type { CasesPort } from '../../application/ports'

export interface CasesServices {
  port: CasesPort
  /** True in fixture mode: labels data as demonstration data. */
  demo: boolean
  clock: Clock
}

export const CasesContext = createContext<CasesServices | null>(null)

export function useCasesServices(): CasesServices {
  const services = useContext(CasesContext)
  if (!services) throw new Error('Cases services are unavailable')
  return services
}
