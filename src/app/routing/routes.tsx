import type { ReactNode } from 'react'
import type { RouteObject } from 'react-router'
import type { BreadcrumbItem } from '@/shared/components'
import { AppLayout } from '../layouts/AppLayout'
import { RequireRole, RequireSession, RoleHomeRedirect } from './guards'
import {
  AccessDeniedPage,
  AdminDashboardPage,
  DeviceSessionsPage,
  DivisionDetailPage,
  DivisionsPage,
  EstateDetailPage,
  EstatesPage,
  LoginPage,
  ProfilePage,
  RoleDetailPage,
  RolesPage,
  ScreenLoading,
  SessionExpiredPage,
  SessionRecoveryPage,
  UserDetailPage,
  UserFormPage,
  UserScopePage,
  UsersPage,
} from './identityScreens'
import { NotFoundScreen, ScreenPending } from './PlaceholderScreens'
import { SCREEN_GROUPS, SHARED_SCREENS } from './screens'
import { CaptureEntryPage, ObservationPage, AssignmentsPage, AssignmentCreatePage, AssignmentDetailPage, AssignmentEditPage } from './captureScreens'
import {
  CorrectionComparePage,
  CorrectionDecisionPage,
  CorrectionDetailPage,
  CorrectionQueuePage,
  DecisionHistoryPage,
  ObservationDecisionPage,
  ObservationReviewPage,
  QuarantineDecisionPage,
  QuarantineQueuePage,
  QuarantineRecordPage,
  ReferralsPage,
  ReviewDashboardPage,
  ReviewQueuePage,
} from './reviewScreens'

/** Route metadata read by the top bar. Pages showing a record refine it with usePageBreadcrumbs. */
export interface RouteHandle {
  breadcrumbs: BreadcrumbItem[]
}

function joinPath(base: string, path: string) {
  return path ? `${base}/${path}` : base
}

/** Implemented screens by full route path. Every other screen still renders its placeholder. */
const IMPLEMENTED: Record<string, ReactNode> = {
  '/review': <ReviewDashboardPage />,
  '/review/queue': <ReviewQueuePage />,
  '/review/observations/:observationId': <ObservationReviewPage />,
  '/review/observations/:observationId/verify': <ObservationDecisionPage kind="verify" />,
  '/review/observations/:observationId/flag': <ObservationDecisionPage kind="flag" />,
  '/review/observations/:observationId/request-correction': <ObservationDecisionPage kind="request-correction" />,
  '/review/observations/:observationId/refer': <ObservationDecisionPage kind="refer" />,
  '/review/corrections': <CorrectionQueuePage />,
  '/review/corrections/:correctionId': <CorrectionDetailPage />,
  '/review/corrections/:correctionId/compare': <CorrectionComparePage />,
  '/review/corrections/:correctionId/approve': <CorrectionDecisionPage kind="approve" />,
  '/review/corrections/:correctionId/reject': <CorrectionDecisionPage kind="reject" />,
  '/review/referrals': <ReferralsPage />,
  '/review/quarantine': <QuarantineQueuePage />,
  '/review/quarantine/:quarantineId': <QuarantineRecordPage />,
  '/review/quarantine/:quarantineId/decide': <QuarantineDecisionPage />,
  '/review/history': <DecisionHistoryPage />,
  '/observations': <CaptureEntryPage />,
  '/observations/:observationId': <ObservationPage view="details" />,
  '/observations/:observationId/evidence': <ObservationPage view="evidence" />,
  '/observations/:observationId/original': <ObservationPage view="original" />,
  '/observations/:observationId/metadata': <ObservationPage view="metadata" />,
  '/observations/:observationId/gps': <ObservationPage view="gps" />,
  '/observations/:observationId/revisions': <ObservationPage view="revisions" />,
  '/observations/:observationId/compare': <ObservationPage view="compare" />,
  '/assignments': <AssignmentsPage />,
  '/assignments/new': <AssignmentCreatePage />,
  '/assignments/:assignmentId/edit': <AssignmentEditPage />,
  '/assignments/:assignmentId': <AssignmentDetailPage />,
  '/admin': <AdminDashboardPage />,
  '/admin/users': <UsersPage />,
  '/admin/users/new': <UserFormPage mode="create" />,
  '/admin/users/:userId': <UserDetailPage />,
  '/admin/users/:userId/edit': <UserFormPage mode="edit" />,
  '/admin/users/:userId/scope': <UserScopePage />,
  '/admin/roles': <RolesPage />,
  '/admin/roles/:role': <RoleDetailPage />,
  '/admin/estates': <EstatesPage />,
  '/admin/estates/:estateId': <EstateDetailPage />,
  '/admin/divisions': <DivisionsPage />,
  '/admin/divisions/:divisionId': <DivisionDetailPage />,
  '/admin/device-sessions': <DeviceSessionsPage />,
  '/admin/device-sessions/:sessionId/recovery': <SessionRecoveryPage />,
}

const roleGroupRoutes: RouteObject[] = SCREEN_GROUPS.map((group) => ({
  path: group.base,
  element: <RequireRole roles={group.roles} />,
  children: group.screens.map((screen) => {
    const fullPath = joinPath(group.base, screen.path)
    const implemented = IMPLEMENTED[fullPath]
    return {
      ...(screen.path ? { path: screen.path } : { index: true }),
      element: implemented ? <ScreenLoading>{implemented}</ScreenLoading> : <ScreenPending screen={screen} />,
      handle: {
        breadcrumbs: [
          { label: group.area, to: group.base },
          { label: screen.title, to: fullPath },
        ],
      } satisfies RouteHandle,
    }
  }),
}))

export function createAppRoutes(): RouteObject[] {
  const { profile, forbidden, login, sessionExpired } = SHARED_SCREENS
  return [
    {
      path: login.path,
      element: (
        <ScreenLoading>
          <LoginPage />
        </ScreenLoading>
      ),
    },
    {
      path: sessionExpired.path,
      element: (
        <ScreenLoading>
          <SessionExpiredPage />
        </ScreenLoading>
      ),
    },
    {
      element: (
        <RequireSession>
          <AppLayout />
        </RequireSession>
      ),
      children: [
        { index: true, element: <RoleHomeRedirect /> },
        ...roleGroupRoutes,
        {
          path: profile.path,
          element: (
            <ScreenLoading>
              <ProfilePage />
            </ScreenLoading>
          ),
          handle: { breadcrumbs: [{ label: profile.area }, { label: profile.title }] } satisfies RouteHandle,
        },
        {
          path: forbidden.path,
          element: (
            <ScreenLoading>
              <AccessDeniedPage />
            </ScreenLoading>
          ),
          handle: { breadcrumbs: [{ label: forbidden.title }] } satisfies RouteHandle,
        },
        { path: '*', element: <NotFoundScreen />, handle: { breadcrumbs: [{ label: 'Page not found' }] } satisfies RouteHandle },
      ],
    },
  ]
}
