import type { ReactNode } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { AppLayout } from '../layouts/AppLayout'
import { RequireRole, RequireSession, RoleHomeRedirect } from './guards'
import type { RouteHandle } from './routeHandle'
import {
  AccessDeniedPage,
  ActivateAccountPage,
  AdminDashboardPage,
  AuditLogsPage,
  DeviceSessionsPage,
  DivisionDetailPage,
  DivisionsPage,
  EstateDetailPage,
  EstatesPage,
  ForgotPasswordPage,
  LoginPage,
  MfaEnrollmentPage,
  MfaVerifyPage,
  PasswordResetSuccessPage,
  ProfilePage,
  RecoveryCodePage,
  ResetPasswordPage,
  ScreenLoading,
  SecurityCenterPage,
  SessionExpiredPage,
  SessionRecoveryPage,
  SystemSettingsPage,
  UserDetailPage,
  UserFormPage,
  UserScopePage,
  UsersPage,
} from './identityScreens'
import {
  AnalyticsDashboardPage,
  EstateOverviewPage,
  DivisionOverviewPage,
  ObservationStatisticsPage,
  DiseaseDistributionPage,
  SuspectedVsConfirmedPage,
  ReviewBottlenecksPage,
  ReportingFiltersPage,
  DataFreshnessPage,
} from './analyticsScreens'
import { NotFoundScreen, ScreenPending } from './PlaceholderScreens'
import { AUTH_FLOW_SCREENS, SCREEN_GROUPS, SHARED_SCREENS } from './screens'
import { CaptureEntryPage, ObservationPage, AssignmentsPage, AssignmentCreatePage, AssignmentDetailPage, AssignmentEditPage } from './captureScreens'
import {
  AssignedCasesPage,
  CaseDetailPage,
  CaseHistoryPage,
  DiseaseCatalogPage,
  DiseaseDetailPage,
  ExpertDashboardPage,
} from './casesScreens'
import {
  CorrectionComparePage,
  CorrectionDecisionPage,
  CorrectionDetailPage,
  CorrectionQueuePage,
  DecisionHistoryPage,
  DivisionQuarantineDetailPage,
  DivisionQuarantineFormPage,
  ExpertDiagnosisFormPage,
  ExpertDiagnosisPage,
  ObservationComparePage,
  ObservationDecisionPage,
  ObservationReviewPage,
  QuarantineDecisionPage,
  QuarantineQueuePage,
  QuarantineRecordPage,
  ReferralsPage,
  ReviewDashboardPage,
  ReviewQueuePage,
} from './reviewScreens'

function joinPath(base: string, path: string) {
  return path ? `${base}/${path}` : base
}

/** Implemented screens by full route path. Every other screen still renders its placeholder. */
const IMPLEMENTED: Record<string, ReactNode> = {
  '/analytics': <AnalyticsDashboardPage />,
  '/analytics/estates': <EstateOverviewPage />,
  '/analytics/divisions': <DivisionOverviewPage />,
  '/analytics/observations': <ObservationStatisticsPage />,
  '/analytics/diseases': <DiseaseDistributionPage />,
  '/analytics/suspected-vs-confirmed': <SuspectedVsConfirmedPage />,
  '/analytics/bottlenecks': <ReviewBottlenecksPage />,
  '/analytics/filters': <ReportingFiltersPage />,
  '/analytics/freshness': <DataFreshnessPage />,
  '/cases': <ExpertDashboardPage />,
  '/cases/assigned': <AssignedCasesPage />,
  '/cases/catalog': <DiseaseCatalogPage />,
  '/cases/catalog/:diseaseId': <DiseaseDetailPage />,
  '/cases/history': <CaseHistoryPage />,
  '/cases/referrals/:referralId': <CaseDetailPage />,
  '/cases/:caseId': <CaseDetailPage />,
  '/cases/:caseId/evidence': <CaseDetailPage />,
  '/cases/:caseId/diagnose': <CaseDetailPage />,
  '/cases/:caseId/diagnose/confirm': <CaseDetailPage />,
  '/review': <ReviewDashboardPage />,
  '/review/queue': <ReviewQueuePage />,
  '/review/observations/:observationId': <ObservationReviewPage />,
  '/review/observations/:observationId/compare': <ObservationComparePage />,
  '/review/observations/:observationId/diagnosis': <ExpertDiagnosisPage />,
  '/review/observations/:observationId/diagnosis/new': <ExpertDiagnosisFormPage />,
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
  '/review/quarantine/divisions/new': <DivisionQuarantineFormPage />,
  '/review/quarantine/divisions/:divisionQuarantineId': <DivisionQuarantineDetailPage />,
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
  // Roles & Permissions was removed: roles are assigned in User Management and access changes
  // are recorded in the Audit Logs. Old links open the Audit Logs.
  '/admin/roles': <Navigate to="/admin/audit-logs" replace />,
  '/admin/roles/:role': <Navigate to="/admin/audit-logs" replace />,
  '/admin/estates': <EstatesPage />,
  '/admin/estates/:estateId': <EstateDetailPage />,
  '/admin/divisions': <DivisionsPage />,
  '/admin/divisions/:divisionId': <DivisionDetailPage />,
  '/admin/device-sessions': <DeviceSessionsPage />,
  '/admin/device-sessions/:sessionId/recovery': <SessionRecoveryPage />,
  '/admin/security': <SecurityCenterPage />,
  '/admin/audit-logs': <AuditLogsPage />,
  '/admin/settings': <SystemSettingsPage />,
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

/** Public MFA, recovery and activation screens. None of them creates a session by itself. */
const AUTH_FLOW_PAGES: Record<keyof typeof AUTH_FLOW_SCREENS, ReactNode> = {
  mfaVerify: <MfaVerifyPage />,
  mfaSetup: <MfaEnrollmentPage />,
  forgotPassword: <ForgotPasswordPage />,
  recoveryCode: <RecoveryCodePage />,
  resetPassword: <ResetPasswordPage />,
  resetComplete: <PasswordResetSuccessPage />,
  activate: <ActivateAccountPage />,
}

const authFlowRoutes: RouteObject[] = (Object.keys(AUTH_FLOW_SCREENS) as Array<keyof typeof AUTH_FLOW_SCREENS>).map((key) => ({
  path: AUTH_FLOW_SCREENS[key].path,
  element: <ScreenLoading>{AUTH_FLOW_PAGES[key]}</ScreenLoading>,
}))

export function createAppRoutes(): RouteObject[] {
  const { profile, forbidden, login, sessionExpired } = SHARED_SCREENS
  return [
    ...authFlowRoutes,
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
