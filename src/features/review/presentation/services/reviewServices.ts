import { createContext, useContext } from 'react'
import type { Clock } from '@/shared/utilities/clock'
import type { ReviewPort } from '../../application/ports'

export interface ReviewServices {
  port: ReviewPort
  /** True in fixture mode: screens label data as demonstration data and offer simulations. */
  demo: boolean
  /** "Today" for ages and date filters (pinned to 21 Oct 2026 in fixture mode). */
  clock: Clock
}

export const ReviewContext = createContext<ReviewServices | null>(null)

export function useReviewServices(): ReviewServices {
  const services = useContext(ReviewContext)
  if (!services) throw new Error('Review services are unavailable')
  return services
}
