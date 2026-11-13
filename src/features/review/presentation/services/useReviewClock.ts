import { useState } from 'react'
import { useReviewServices } from './reviewServices'

/** The current instant, read once per mount so a screen stays consistent while open. */
export function useReviewClock(): Date {
  const { clock } = useReviewServices()
  const [now] = useState(() => clock.now())
  return now
}
