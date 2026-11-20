import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Badge,
  Banner,
  BarList,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  KpiCard,
  Modal,
  PageHeader,
  SelectField,
  TextAreaField,
  Toggle,
  usePageBreadcrumbs,
} from '@/shared/components'
import { Icon } from '@/shared/design-system'
import {
  CASE_STATUSES,
  CASE_STATUS_LABEL,
  type CaseRecord,
  type CaseStatus,
  type CasesWorkspace,
} from '../../domain/models'
import {
  CaseStatusBadge,
  CasesQueryBoundary,
  CatalogStatusBadge,
  DiseaseCategoryBadge,
  SeverityBadge,
} from '../components/badges'
import { casesPaths, formatCaseDate, formatCaseLongDate } from '../components/format'
import { CaseIdLink } from '../components/parts'
import { useCasesServices } from '../services/casesServices'
import { useCasesActions, useCasesWorkspace } from '../services/queries'
import styles from '../components/cases.module.css'

const STATUS_DISTRIBUTION: Array<[CaseStatus, string]> = [
  ['awaiting_diagnosis', '#e2a62f'],
  ['pending_link', '#2c9a8e'],
  ['diagnosed', '#2e7d32'],
  ['closed', '#6b7a72'],
]

const DIVISION_COLORS = ['#2e7d32', '#7cb342', '#4f9d69', '#2c9a8e']

/**
 * CASE-01 Expert Dashboard (Member 4).
 * Matches REV-01 Supervisor Dashboard structure and visual neatness:
 * - PageHeader with 2 clean actions
 * - 4 KPI cards row
 * - 3-column row (`row3`): Case status distribution (BarList), Needs your attention, Cases by division (BarList)
 * - Awaiting your diagnosis table
 * - Recent confirmed diagnoses & Disease catalog quick reference split
 */
export function ExpertDashboardPage() {
  usePageBreadcrumbs([{ label: 'Cases', to: casesPaths.dashboard }, { label: 'Expert Dashboard' }])
  const query = useCasesWorkspace()
  const { clock } = useCasesServices()
  return (
    <CasesQueryBoundary query={query} label="expert dashboard">
      {(workspace) => <DashboardView workspace={workspace} today={clock.now()} />}
    </CasesQueryBoundary>
  )
}

function DashboardView({ workspace, today }: { workspace: CasesWorkspace; today: Date }) {
  const navigate = useNavigate()
  const actions = useCasesActions()
  const [aiModalOpen, setAiModalOpen] = useState(false)

  // AI Assistant state
  const [selectedThreadId, setSelectedThreadId] = useState(workspace.aiThreads[0]?.id ?? 'AI-THR-001')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiContextCaseId, setAiContextCaseId] = useState('CASE-023')
  const [aiContextDiseaseId, setAiContextDiseaseId] = useState('DIS-003')
  const [degradedMode, setDegradedMode] = useState(false)

  const awaitingCases = workspace.cases.filter((c) => c.status === 'awaiting_diagnosis')
  const pendingLinkCases = workspace.cases.filter((c) => c.status === 'pending_link')
  const recentDiagnoses = workspace.history.slice(0, 4)
  const activeThread = workspace.aiThreads.find((t) => t.id === selectedThreadId) ?? workspace.aiThreads[0]

  const statusCounts = Object.fromEntries(
    CASE_STATUSES.map((s) => [s, workspace.cases.filter((c) => c.status === s).length]),
  ) as Record<CaseStatus, number>

  const scopeLabel = workspace.estates.map((e) => `${e.name} (${e.id})`).join(', ')

  const attentionItems = [
    ...pendingLinkCases.map((item) => ({
      id: item.referralId,
      title: `${item.referralId} pending case link`,
      detail: `${item.observationId} · ${item.division.name} · referred by ${item.referredBy.fullName}`,
      to: casesPaths.pendingReferral(item.referralId),
    })),
    ...awaitingCases.map((item) => ({
      id: item.id,
      title: `${item.id} awaiting diagnosis`,
      detail: `${item.observationId} · ${item.division.name} · suspected ${item.suspectedDisease.name}`,
      to: casesPaths.caseDetail(item.id),
    })),
    ...workspace.diseases
      .filter((d) => d.status === 'draft' || d.draftChanges !== null)
      .map((d) => ({
        id: d.id,
        title: `${d.id} · ${d.name} (v3 draft)`,
        detail: `${d.pathogen} · review diff before publishing Catalog v3`,
        to: casesPaths.catalogDisease(d.id),
      })),
  ]

  const handleSendAiPrompt = () => {
    if (!aiPrompt.trim()) return
    actions.sendAiPrompt.mutate(
      {
        threadId: activeThread?.id ?? 'AI-THR-001',
        prompt: aiPrompt,
        contextCaseId: aiContextCaseId || undefined,
        contextDiseaseId: aiContextDiseaseId || undefined,
        simulateDegradedMode: degradedMode,
      },
      {
        onSuccess: (updated) => {
          setSelectedThreadId(updated.id)
          setAiPrompt('')
        },
      },
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Expert Dashboard"
        subtitle={`${scopeLabel} · ${workspace.cases.length} cases in your scope · Catalog v${workspace.kpis.activeCatalogVersion} · ${formatCaseLongDate(today)}`}
        actions={
          <>
            <Button variant="secondary" icon="info" onClick={() => setAiModalOpen(true)}>
              Advisory AI Assistant
            </Button>
            <ButtonLink icon="inbox" to={casesPaths.assigned}>
              Assigned Cases
            </ButtonLink>
          </>
        }
      />

      <div className={styles.kpiRow4}>
        <Link to={`${casesPaths.assigned}?tab=awaiting_diagnosis`} className={styles.kpiLink}>
          <KpiCard
            label="Awaiting diagnosis"
            value={workspace.kpis.awaitingDiagnosisCount}
            caption={awaitingCases.map((c) => c.id).join(', ') || 'None'}
            tone="warning"
            icon="clock"
          />
        </Link>
        <Link to={`${casesPaths.assigned}?tab=diagnosed`} className={styles.kpiLink}>
          <KpiCard
            label="Diagnosed cases"
            value={workspace.kpis.diagnosedCount}
            caption={`Pinned to Catalog v${workspace.kpis.activeCatalogVersion}`}
            tone="success"
            icon="check"
          />
        </Link>
        <Link to={`${casesPaths.assigned}?tab=pending_link`} className={styles.kpiLink}>
          <KpiCard
            label="Pending case link"
            value={workspace.kpis.pendingLinkCount}
            caption={pendingLinkCases.map((c) => c.referralId).join(', ') || 'None'}
            tone="info"
            icon="link"
          />
        </Link>
        <Link to={casesPaths.history} className={styles.kpiLink}>
          <KpiCard
            label="Avg. time to diagnose"
            value={`${workspace.kpis.avgDiagnosisHours}h`}
            caption="Referral to official diagnosis"
            tone="purple"
            icon="history"
          />
        </Link>
      </div>

      <div className={styles.row3}>
        <Card title="Case status distribution" className={styles.wideBars}>
          <BarList
            label="Case status distribution"
            max={Math.max(1, ...Object.values(statusCounts))}
            items={STATUS_DISTRIBUTION.map(([key, color]) => ({
              id: key,
              label: CASE_STATUS_LABEL[key],
              value: statusCounts[key],
              color,
            }))}
          />
        </Card>

        <Card title="Needs your attention">
          {attentionItems.length === 0 ? (
            <EmptyState
              title="Nothing needs your attention"
              message="Pending referrals, awaiting cases and catalog drafts appear here."
              icon="check"
            />
          ) : (
            <ul className={styles.attentionList}>
              {attentionItems.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <Link className={styles.attentionCard} to={item.to}>
                    <span>
                      <span className={styles.attentionTitle}>{item.title}</span>
                      <span className={styles.attentionDetail}>{item.detail}</span>
                    </span>
                    <Icon name="right" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Cases by division" className={styles.wideBars}>
          <BarList
            label="Cases by division"
            items={workspace.divisions.map((division, index) => ({
              id: division.id,
              label: `${division.name} (${division.id})`,
              value: workspace.cases.filter((c) => c.division.id === division.id).length,
              color: DIVISION_COLORS[index % DIVISION_COLORS.length],
            }))}
          />
        </Card>
      </div>

      <Card
        title="Awaiting your diagnosis"
        action={
          <Link className={styles.idLink} to={`${casesPaths.assigned}?tab=awaiting_diagnosis`}>
            View queue
          </Link>
        }
      >
        <DataTable<CaseRecord>
          caption="Cases awaiting expert diagnosis"
          rows={awaitingCases}
          rowKey={(row) => row.id}
          onRowActivate={(row) => void navigate(casesPaths.caseDetail(row.id))}
          empty={<EmptyState title="No cases awaiting diagnosis" icon="check" />}
          columns={[
            {
              id: 'caseId',
              header: 'Case',
              cell: (row) => <CaseIdLink to={casesPaths.caseDetail(row.id)}>{row.id}</CaseIdLink>,
            },
            {
              id: 'observation',
              header: 'Observation',
              cell: (row) => `${row.observationId} · ${row.referralId}`,
            },
            {
              id: 'division',
              header: 'Division',
              cell: (row) => `${row.division.name} (${row.estate.id})`,
            },
            {
              id: 'suspected',
              header: 'Suspected disease',
              cell: (row) => `${row.suspectedDisease.name} (${row.suspectedDisease.id})`,
            },
            {
              id: 'referredAt',
              header: 'Referred',
              cell: (row) => formatCaseDate(row.referredAt),
            },
            {
              id: 'status',
              header: 'Status',
              cell: (row) => <CaseStatusBadge status={row.status} />,
            },
            {
              id: 'action',
              header: 'Action',
              align: 'end',
              cell: (row) => (
                <Link
                  className={styles.idLink}
                  to={casesPaths.caseDetail(row.id)}
                  onClick={(e) => e.stopPropagation()}
                >
                  Diagnose →
                </Link>
              ),
            },
          ]}
        />
      </Card>

      <div className={styles.split}>
        <Card
          title="Recent confirmed diagnoses"
          action={
            <Link className={styles.idLink} to={casesPaths.history}>
              View history
            </Link>
          }
        >
          <DataTable
            caption="Recent confirmed diagnoses"
            rows={recentDiagnoses}
            rowKey={(row) => row.id}
            onRowActivate={(row) => void navigate(casesPaths.caseDetail(row.caseId))}
            columns={[
              {
                id: 'caseId',
                header: 'Case',
                cell: (row) => <CaseIdLink to={casesPaths.caseDetail(row.caseId)}>{row.caseId}</CaseIdLink>,
              },
              {
                id: 'confirmed',
                header: 'Confirmed disease',
                cell: (row) => `${row.confirmedDisease.name} (v${row.catalogVersion})`,
              },
              {
                id: 'severity',
                header: 'Severity',
                cell: (row) => <SeverityBadge severity={row.severity} />,
              },
              {
                id: 'diagnosedAt',
                header: 'Diagnosed',
                cell: (row) => formatCaseDate(row.diagnosedAt),
              },
            ]}
          />
        </Card>

        <Card
          title="Disease catalog quick reference"
          action={
            <Link className={styles.idLink} to={casesPaths.catalog}>
              Open catalog
            </Link>
          }
        >
          <DataTable
            caption="Disease catalog summary"
            rows={workspace.diseases}
            rowKey={(row) => row.id}
            onRowActivate={(row) => void navigate(casesPaths.catalogDisease(row.id))}
            columns={[
              {
                id: 'id',
                header: 'Disease',
                cell: (row) => (
                  <CaseIdLink to={casesPaths.catalogDisease(row.id)}>
                    {row.name} ({row.id})
                  </CaseIdLink>
                ),
              },
              {
                id: 'category',
                header: 'Category',
                cell: (row) => <DiseaseCategoryBadge category={row.category} />,
              },
              {
                id: 'version',
                header: 'Version',
                cell: (row) => `v${row.catalogVersion}${row.draftChanges ? ' · v3 diff' : ''}`,
              },
              {
                id: 'status',
                header: 'Status',
                cell: (row) => <CatalogStatusBadge status={row.status} />,
              },
            ]}
          />
        </Card>
      </div>

      {/* Advisory-Only AI Assistant Modal */}
      <Modal
        open={aiModalOpen}
        title="Advisory AI Assistant · TeaLeaf Clinical Copilot"
        description="Strictly advisory decision support. Responses cite the active Disease Catalog and never record or modify an official case diagnosis."
        onClose={() => setAiModalOpen(false)}
        size="large"
        footer={
          <Button variant="secondary" onClick={() => setAiModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className={styles.stack}>
          <Banner
            tone={degradedMode ? 'warning' : 'info'}
            title={
              degradedMode
                ? 'Degraded Mode Active · Deterministic Catalog Matcher'
                : 'Advisory-Only Safeguard Active'
            }
          >
            {degradedMode
              ? 'Live inference is simulated offline. Queries are answered deterministically from local Active Catalog v2 rules.'
              : 'AI suggestions are non-authoritative. Only a signed-in Disease Expert can confirm a diagnosis on the Record Diagnosis screen.'}
          </Banner>

          <div className={styles.evidenceToolbar}>
            <div className={styles.actionsInline}>
              <SelectField
                label="Case context"
                value={aiContextCaseId}
                onChange={(e) => setAiContextCaseId(e.target.value)}
                options={workspace.cases.map((c) => ({
                  value: c.id,
                  label: `${c.id} (${c.observationId} · ${c.division.name})`,
                }))}
              />
              <SelectField
                label="Catalog disease"
                value={aiContextDiseaseId}
                onChange={(e) => setAiContextDiseaseId(e.target.value)}
                options={workspace.diseases.map((d) => ({
                  value: d.id,
                  label: `${d.id} · ${d.name} (v${d.catalogVersion})`,
                }))}
              />
            </div>
            <Toggle
              label="Simulate Degraded / Offline Fallback"
              checked={degradedMode}
              onChange={(e) => setDegradedMode(e.target.checked)}
            />
          </div>

          <div className={styles.aiLayout}>
            <Card title="Conversations">
              <ul className={styles.attentionList}>
                {workspace.aiThreads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedThreadId(t.id)}
                      className={styles.attentionCard}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderColor: t.id === activeThread?.id ? '#338732' : undefined,
                      }}
                    >
                      <div>
                        <span className={styles.attentionTitle}>{t.title}</span>
                        <span className={styles.attentionDetail}>{t.contextBadge}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <div className={styles.stack}>
              <div className={styles.chatStream} aria-label="AI Assistant conversation">
                {activeThread?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant}
                  >
                    <div>{msg.content}</div>
                    {msg.isDegradedFallback && (
                      <div style={{ marginTop: 8 }}>
                        <Badge tone="warning">Degraded Mode Fallback · Local Catalog v2</Badge>
                      </div>
                    )}
                    {msg.citations.map((cit) => (
                      <div key={cit.code} className={styles.citationCard}>
                        <strong>
                          {cit.code} — {cit.title}
                        </strong>{' '}
                        <span>({cit.version})</span>
                        <div className={styles.caption}>{cit.excerpt}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <TextAreaField
                label="Ask a differential diagnosis or catalog treatment question"
                rows={2}
                value={aiPrompt}
                placeholder="Compare concentric acervuli in DIS-002 against marginal necrosis in CASE-023..."
                onChange={(e) => setAiPrompt(e.target.value)}
              />
              <div className={styles.actionsInline}>
                <Button
                  icon="send"
                  loading={actions.sendAiPrompt.isPending}
                  onClick={handleSendAiPrompt}
                >
                  Send Advisory Query
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
