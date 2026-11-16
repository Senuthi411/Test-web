import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type {
  ApproveCorrectionInput,
  CorrectionRequestInput,
  DecisionMeta,
  FlagInput,
  ReferralInput,
  RejectCorrectionInput,
  ReviewStatus,
  ReviewWorkspace,
  VerifyInput,
} from '../../domain/models'
import { RESULTING_STATUS, type ResubmissionInput } from '../../domain/rules'
import { useToast } from '@/shared/components'
import type { ReviewExportKind } from '../../application/ports'
import { errorText } from '../components/format'
import { useReviewServices } from './reviewServices'

export const reviewKeys = {
  all: ['review'] as const,
  workspace: () => ['review', 'workspace'] as const,
  observation: (id: string) => ['review', 'observation', id] as const,
}

export function useReviewWorkspace() {
  const { port } = useReviewServices()
  return useQuery({ queryKey: reviewKeys.workspace(), queryFn: ({ signal }) => port.getWorkspace(signal) })
}

export function useObservationReview(id: string) {
  const { port } = useReviewServices()
  return useQuery({ queryKey: reviewKeys.observation(id), queryFn: ({ signal }) => port.getObservationReview(id, signal) })
}

type Meta = { meta: DecisionMeta }

/**
 * Writes an observation's new review status into the cached workspace (queue, dashboard
 * counts) at once, so no screen shows the previous status while the refetch runs.
 */
function setCachedStatus(client: QueryClient, observationId: string, status: ReviewStatus) {
  client.setQueryData<ReviewWorkspace>(reviewKeys.workspace(), (workspace) =>
    workspace && {
      ...workspace,
      observations: workspace.observations.map((item) => (item.id === observationId ? { ...item, reviewStatus: status } : item)),
    },
  )
}

const refreshReviewData = (client: QueryClient) =>
  Promise.all([client.invalidateQueries({ queryKey: reviewKeys.all }), client.invalidateQueries({ queryKey: ['capture'] })])

/**
 * Claims a Submitted observation when the Supervisor opens it (Submitted → In review).
 * The claimed record replaces the cached review immediately; other statuses come back unchanged.
 */
export function useClaimObservation() {
  const { port } = useReviewServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => port.claim(id),
    onSuccess: async (review) => {
      client.setQueryData(reviewKeys.observation(review.observation.id), review)
      setCachedStatus(client, review.observation.id, review.observation.reviewStatus)
      await refreshReviewData(client)
    },
  })
}

/**
 * Review mutations. Success invalidates Review data and Capture reads, which show the same
 * shared review status. Review writes never change Capture assignment or evidence records.
 */
export function useReviewActions() {
  const { port } = useReviewServices()
  const client = useQueryClient()
  const refresh = async () => {
    await refreshReviewData(client)
  }
  const decided = (status: ReviewStatus) => async (_result: unknown, variables: { id: string }) => {
    setCachedStatus(client, variables.id, status)
    await refresh()
  }
  return {
    verify: useMutation({ mutationFn: (v: { id: string; input: VerifyInput } & Meta) => port.verify(v.id, v.input, v.meta), onSuccess: decided(RESULTING_STATUS.verify) }),
    flag: useMutation({ mutationFn: (v: { id: string; input: FlagInput } & Meta) => port.flag(v.id, v.input, v.meta), onSuccess: decided(RESULTING_STATUS.flag) }),
    requestCorrection: useMutation({ mutationFn: (v: { id: string; input: CorrectionRequestInput } & Meta) => port.requestCorrection(v.id, v.input, v.meta), onSuccess: decided(RESULTING_STATUS.requestCorrection) }),
    refer: useMutation({ mutationFn: (v: { id: string; input: ReferralInput } & Meta) => port.refer(v.id, v.input, v.meta), onSuccess: decided(RESULTING_STATUS.refer) }),
    approve: useMutation({ mutationFn: (v: { id: string; input: ApproveCorrectionInput } & Meta) => port.approveCorrection(v.id, v.input, v.meta), onSuccess: refresh }),
    reject: useMutation({ mutationFn: (v: { id: string; input: RejectCorrectionInput } & Meta) => port.rejectCorrection(v.id, v.input, v.meta), onSuccess: refresh }),
    applyRevision: useMutation({ mutationFn: (v: { id: string; version: number }) => port.simulateRevisionApplied(v.id, v.version), onSuccess: refresh }),
    /** Fixture-only: the Field Worker's corrected resubmission (Capture mobile app stand-in). */
    resubmit: useMutation({
      mutationFn: (v: { id: string; input: ResubmissionInput; version: number }) => port.simulateResubmission(v.id, v.input, v.version),
      onSuccess: async (correction) => {
        setCachedStatus(client, correction.observation.id, 'resubmitted')
        await refresh()
      },
    }),
  }
}

/** Export button: fixture mode reports that no file is produced; failures are shown, never hidden. */
export function useReviewExport(kind: ReviewExportKind) {
  const { port } = useReviewServices()
  const toast = useToast()
  const mutation = useMutation({ mutationFn: () => port.exportList(kind) })
  return {
    pending: mutation.isPending,
    run() {
      mutation.mutate(undefined, {
        onSuccess: (result) =>
          toast.show(
            result.simulated
              ? { tone: 'info', title: 'Export simulated', message: 'Demonstration data: no file is produced in fixture mode.' }
              : { tone: 'success', title: 'Export started' },
          ),
        onError: (error) => toast.show({ tone: 'error', title: 'Export failed', message: errorText(error) }),
      })
    },
  }
}
