import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DivisionId, EstateId, UserId } from '@/shared/types'
import type { DivisionInput, EstateInput, ScopeChangeInput, UserInput, VersionedInput } from '../../application/ports'
import type { ExportKind, NotificationPreferenceKey, Profile } from '../../domain/models'
import { useIdentityServices } from './identityServices'

/** Every Identity query key starts with this, so a write can refresh all Identity screens. */
export const IDENTITY_KEY = ['identity'] as const

export const identityKeys = {
  dashboard: () => [...IDENTITY_KEY, 'dashboard'] as const,
  users: () => [...IDENTITY_KEY, 'users'] as const,
  user: (id: UserId) => [...IDENTITY_KEY, 'user', id] as const,
  estates: () => [...IDENTITY_KEY, 'estates'] as const,
  estate: (id: EstateId) => [...IDENTITY_KEY, 'estate', id] as const,
  divisions: () => [...IDENTITY_KEY, 'divisions'] as const,
  division: (id: DivisionId) => [...IDENTITY_KEY, 'division', id] as const,
  sessions: () => [...IDENTITY_KEY, 'device-sessions'] as const,
  recovery: (sessionId: string) => [...IDENTITY_KEY, 'recovery', sessionId] as const,
  profile: (id: UserId) => [...IDENTITY_KEY, 'profile', id] as const,
}

export function useAdminDashboard() {
  const { admin } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.dashboard(), queryFn: ({ signal }) => admin.getDashboard(signal) })
}

export function useUsers() {
  const { admin } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.users(), queryFn: ({ signal }) => admin.listUsers(signal) })
}

export function useUserDetail(userId: UserId) {
  const { admin } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.user(userId), queryFn: ({ signal }) => admin.getUser(userId, signal) })
}

export function useEstates() {
  const { admin } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.estates(), queryFn: ({ signal }) => admin.listEstates(signal) })
}

export function useEstateDetail(estateId: EstateId) {
  const { admin } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.estate(estateId), queryFn: ({ signal }) => admin.getEstate(estateId, signal) })
}

export function useDivisions() {
  const { admin } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.divisions(), queryFn: ({ signal }) => admin.listDivisions(signal) })
}

export function useDivisionDetail(divisionId: DivisionId) {
  const { admin } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.division(divisionId), queryFn: ({ signal }) => admin.getDivision(divisionId, signal) })
}

export function useDeviceSessions() {
  const { admin } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.sessions(), queryFn: ({ signal }) => admin.listDeviceSessions(signal) })
}

export function useRecoveryRequest(sessionId: string) {
  const { admin } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.recovery(sessionId), queryFn: ({ signal }) => admin.getRecoveryRequest(sessionId, signal) })
}

export function useProfile(userId: UserId) {
  const { account } = useIdentityServices()
  return useQuery({ queryKey: identityKeys.profile(userId), queryFn: ({ signal }) => account.getProfile(userId, signal) })
}

/** A mutation that refreshes every Identity query once it succeeds. */
function useIdentityMutation<Variables, Result>(mutationFn: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: IDENTITY_KEY }),
  })
}

export function useCreateUser() {
  const { admin } = useIdentityServices()
  return useIdentityMutation((input: UserInput) => admin.createUser(input))
}

export function useUpdateUser(userId: UserId) {
  const { admin } = useIdentityServices()
  return useIdentityMutation((input: UserInput & VersionedInput) => admin.updateUser(userId, input))
}

export function useUpdateUserScope(userId: UserId) {
  const { admin } = useIdentityServices()
  return useIdentityMutation((input: ScopeChangeInput) => admin.updateUserScope(userId, input))
}

export function useCreateEstate() {
  const { admin } = useIdentityServices()
  return useIdentityMutation((input: EstateInput) => admin.createEstate(input))
}

export function useUpdateEstate() {
  const { admin } = useIdentityServices()
  return useIdentityMutation(({ id, input }: { id: EstateId; input: EstateInput }) => admin.updateEstate(id, input))
}

export function useCreateDivision() {
  const { admin } = useIdentityServices()
  return useIdentityMutation((input: DivisionInput) => admin.createDivision(input))
}

export function useUpdateDivision() {
  const { admin } = useIdentityServices()
  return useIdentityMutation(({ id, input }: { id: DivisionId; input: Omit<DivisionInput, 'estateId'> }) => admin.updateDivision(id, input))
}

export function useRevokeDeviceSession() {
  const { admin } = useIdentityServices()
  return useIdentityMutation((sessionId: string) => admin.revokeDeviceSession(sessionId))
}

export function useRequestSessionRecovery() {
  const { admin } = useIdentityServices()
  return useIdentityMutation((sessionId: string) => admin.requestSessionRecovery(sessionId))
}

export function useExport() {
  const { admin } = useIdentityServices()
  return useMutation({ mutationFn: (kind: ExportKind) => admin.exportData(kind) })
}

export function useUpdateProfile(userId: UserId) {
  const { account } = useIdentityServices()
  return useIdentityMutation((input: { fullName: string; language: Profile['language'] }) => account.updateProfile(userId, input))
}

export function useChangePassword(userId: UserId) {
  const { account } = useIdentityServices()
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => account.changePassword(userId, input),
  })
}

export function useSetNotificationPreference(userId: UserId) {
  const { account } = useIdentityServices()
  return useIdentityMutation(({ key, enabled }: { key: NotificationPreferenceKey; enabled: boolean }) =>
    account.setNotificationPreference(userId, key, enabled),
  )
}
