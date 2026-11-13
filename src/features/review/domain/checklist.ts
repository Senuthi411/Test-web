/** REV-04 Verification checklist. Item 4 interpolates the observation's GPS accuracy. */
export const VERIFICATION_CHECKLIST = [
  { id: 'image', label: () => 'Evidence image is clear and shows the leaf symptoms' },
  { id: 'location', label: () => 'Location is inside the assigned division' },
  { id: 'symptoms', label: () => 'Symptoms match the suspected disease' },
  { id: 'gps', label: (accuracyM: number) => `GPS accuracy (±${accuracyM} m) is acceptable for this division`, hint: 'Review the accuracy band before accepting' },
] as const

/** Reason values shown in the approved designs. No other catalogue is specified. */
export const FLAG_REASONS = ['Image quality issue'] as const
export const FLAG_CATEGORIES = ['Evidence'] as const
export const REJECTION_REASONS = ['Evidence still unclear'] as const
