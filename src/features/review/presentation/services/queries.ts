import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ApproveCorrectionInput,
  CorrectionRequestInput,
  DecisionMeta,
  FlagInput,
  ReferralInput,
  RejectCorrectionInput,
  VerifyInput,
} from '../../domain/models'
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
 * Review mutations. Success invalidates Review data and Capture reads, which show the same
 * shared review status. Review writes never change Capture assignment or evidence records.
 */
export function useReviewActions() {
  const { port } = useReviewServices()
  const client = useQueryClient()
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: reviewKeys.all }),
      client.invalidateQueries({ queryKey: ['capture'] }),
    ])
  }
  return {
    verify: useMutation({ mutationFn: (v: { id: string; input: VerifyInput } & Meta) => port.verify(v.id, v.input, v.meta), onSuccess: refresh }),
    flag: useMutation({ mutationFn: (v: { id: string; input: FlagInput } & Meta) => port.flag(v.id, v.input, v.meta), onSuccess: refresh }),
    requestCorrection: useMutation({ mutationFn: (v: { id: string; input: CorrectionRequestInput } & Meta) => port.requestCorrection(v.id, v.input, v.meta), onSuccess: refresh }),
    refer: useMutation({ mutationFn: (v: { id: string; input: ReferralInput } & Meta) => port.refer(v.id, v.input, v.meta), onSuccess: refresh }),
    approve: useMutation({ mutationFn: (v: { id: string; input: ApproveCorrectionInput } & Meta) => port.approveCorrection(v.id, v.input, v.meta), onSuccess: refresh }),
    reject: useMutation({ mutationFn: (v: { id: string; input: RejectCorrectionInput } & Meta) => port.rejectCorrection(v.id, v.input, v.meta), onSuccess: refresh }),
    applyRevision: useMutation({ mutationFn: (v: { id: string; version: number }) => port.simulateRevisionApplied(v.id, v.version), onSuccess: refresh }),
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
