import { lazy } from 'react'
const load = () => import('@/features/capture/pages')
export const CaptureEntryPage = lazy(() => load().then((module) => ({ default: module.CaptureEntryPage })))
export const ObservationPage = lazy(() => load().then((module) => ({ default: module.ObservationPage })))
export const AssignmentsPage = lazy(() => load().then((module) => ({ default: module.AssignmentsPage })))
export const AssignmentCreatePage = lazy(() => load().then((module) => ({ default: module.AssignmentCreatePage })))
export const AssignmentDetailPage = lazy(() => load().then((module) => ({ default: module.AssignmentDetailPage })))

export const AssignmentEditPage = lazy(() => load().then((module) => ({ default: module.AssignmentEditPage })))
