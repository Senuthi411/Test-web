import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/shared/components'
import type { CasesExportKind } from '../../application/ports'
import type {
  CasesDecisionMeta,
  DeactivateCatalogDiseaseInput,
  PublishCatalogVersionInput,
  RecordCaseDiagnosisInput,
  SaveCatalogDraftInput,
  SendAiAdvisoryPromptInput,
} from '../../domain/models'
import { casesErrorText } from '../components/format'
import { useCasesServices } from './casesServices'

export const casesKeys = {
  all: ['cases'] as const,
  workspace: () => ['cases', 'workspace'] as const,
  caseRecord: (id: string) => ['cases', 'record', id] as const,
  disease: (id: string) => ['cases', 'disease', id] as const,
}

export function useCasesWorkspace() {
  const { port } = useCasesServices()
  return useQuery({
    queryKey: casesKeys.workspace(),
    queryFn: ({ signal }) => port.getWorkspace(signal),
  })
}

export function useCaseRecord(caseOrReferralId: string) {
  const { port } = useCasesServices()
  return useQuery({
    queryKey: casesKeys.caseRecord(caseOrReferralId),
    queryFn: ({ signal }) => port.getCase(caseOrReferralId, signal),
    enabled: Boolean(caseOrReferralId.trim()),
  })
}

export function useCatalogDisease(diseaseId: string) {
  const { port } = useCasesServices()
  return useQuery({
    queryKey: casesKeys.disease(diseaseId),
    queryFn: ({ signal }) => port.getDisease(diseaseId, signal),
    enabled: Boolean(diseaseId.trim()),
  })
}

export function useCasesActions() {
  const { port } = useCasesServices()
  const client = useQueryClient()

  const refreshAll = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: casesKeys.all }),
      client.invalidateQueries({ queryKey: ['review'] }),
      client.invalidateQueries({ queryKey: ['capture'] }),
    ])
  }

  return {
    linkReferral: useMutation({
      mutationFn: (v: { referralId: string; meta: CasesDecisionMeta }) => port.linkPendingReferral(v.referralId, v.meta),
      onSuccess: refreshAll,
    }),
    recordDiagnosis: useMutation({
      mutationFn: (v: { caseId: string; input: RecordCaseDiagnosisInput; meta: CasesDecisionMeta }) =>
        port.recordDiagnosis(v.caseId, v.input, v.meta),
      onSuccess: refreshAll,
    }),
    closeCase: useMutation({
      mutationFn: (v: { caseId: string; meta: CasesDecisionMeta }) => port.closeCase(v.caseId, v.meta),
      onSuccess: refreshAll,
    }),
    saveCatalogDraft: useMutation({
      mutationFn: (v: { input: SaveCatalogDraftInput; meta: CasesDecisionMeta }) =>
        port.saveCatalogDraft(v.input, v.meta),
      onSuccess: refreshAll,
    }),
    publishCatalogVersion: useMutation({
      mutationFn: (v: { input: PublishCatalogVersionInput; meta: CasesDecisionMeta }) =>
        port.publishCatalogVersion(v.input, v.meta),
      onSuccess: refreshAll,
    }),
    deactivateDisease: useMutation({
      mutationFn: (v: { input: DeactivateCatalogDiseaseInput; meta: CasesDecisionMeta }) =>
        port.deactivateDisease(v.input, v.meta),
      onSuccess: refreshAll,
    }),
    sendAiPrompt: useMutation({
      mutationFn: (input: SendAiAdvisoryPromptInput) => port.sendAiPrompt(input),
      onSuccess: refreshAll,
    }),
    markAllNotificationsRead: useMutation({
      mutationFn: () => port.markAllNotificationsRead(),
      onSuccess: refreshAll,
    }),
  }
}

export function useCasesExport(kind: CasesExportKind) {
  const { port } = useCasesServices()
  const toast = useToast()
  const mutation = useMutation({ mutationFn: () => port.exportList(kind) })
  return {
    pending: mutation.isPending,
    run() {
      mutation.mutate(undefined, {
        onSuccess: (result) =>
          toast.show(
            result.simulated
              ? {
                  tone: 'info',
                  title: 'Export simulated',
                  message: 'Demonstration data: no file is downloaded in fixture mode.',
                }
              : { tone: 'success', title: 'Export started' },
          ),
        onError: (error) =>
          toast.show({ tone: 'error', title: 'Export failed', message: casesErrorText(error) }),
      })
    },
  }
}
