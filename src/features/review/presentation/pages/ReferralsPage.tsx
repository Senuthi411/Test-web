import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Badge, Banner, ButtonLink, Card, DataTable, EmptyState, PageHeader, Timeline, usePageBreadcrumbs, type TimelineItem } from '@/shared/components'
import type { Referral } from '../../domain/models'
import { CaseStatusBadge, LinkStatusBadge, QueryBoundary } from '../components/badges'
import { formatDate, formatDateTime, reviewPaths } from '../components/format'
import { Fields, IdLink, Person } from '../components/parts'
import { useReviewWorkspace } from '../services/queries'
import styles from '../components/review.module.css'

/** REV-13 Expert Referral Status (and the REF-014 "pending case link" state after REV-12). */
export function ReferralsPage() {
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Expert Referrals' }])
  const query = useReviewWorkspace()
  const [params] = useSearchParams()
  const sentId = params.get('sent')
  const [selectedId, setSelectedId] = useState<string | null>(sentId)
  const [notice, setNotice] = useState(true)
  const [bannerOpen, setBannerOpen] = useState(true)

  return (
    <QueryBoundary query={query} label="expert referrals">
      {(workspace) => {
        const referrals = [...workspace.referrals].sort((a, b) =>
          a.referredAt.slice(0, 10) === b.referredAt.slice(0, 10) ? a.id.localeCompare(b.id) : b.referredAt.localeCompare(a.referredAt),
        )
        const selected = referrals.find((item) => item.id === selectedId) ?? referrals[0]
        const sent = referrals.find((item) => item.id === sentId)
        return (
          <div className={styles.page}>
            <PageHeader
              title="Expert Referral Status"
              subtitle="Track referrals from your scope to expert diagnosis"
              actions={
                <ButtonLink icon="send" to={`${reviewPaths.queue}?status=in_review`}>
                  Refer an observation
                </ButtonLink>
              }
            />
            {sent && bannerOpen && (
              <Banner tone="success" title={`Referral ${sent.id} sent`} onDismiss={() => setBannerOpen(false)}>
                Referral {sent.id} sent for {sent.observation.id} ({sent.observation.suspectedDisease.name} suspected). Status: referred,{' '}
                {sent.linkStatus === 'linked' ? `linked to ${sent.caseId}` : 'case link pending'}. A referral does not create a case until the case link completes.
              </Banner>
            )}
            <Card>
              <DataTable<Referral>
                caption="Expert referrals"
                rows={referrals}
                rowKey={(row) => row.id}
                onRowActivate={(row) => setSelectedId(row.id)}
                rowLabel={(row) => `Show progress for ${row.id}`}
                empty={<EmptyState title="No referrals in your scope" message="Refer an observation that is In review to a disease expert." icon="send" />}
                columns={[
                  {
                    id: 'referral',
                    header: 'Referral',
                    cell: (row) => (
                      <button type="button" className={styles.linkButton} aria-pressed={row.id === selected?.id} onClick={() => setSelectedId(row.id)}>
                        {row.id}
                      </button>
                    ),
                  },
                  { id: 'observation', header: 'Observation', cell: (row) => <IdLink to={reviewPaths.observation(row.observation.id)}>{row.observation.id}</IdLink> },
                  { id: 'case', header: 'Case', cell: (row) => row.caseId ?? 'Not yet created' },
                  { id: 'expert', header: 'Expert', cell: (row) => <Person name={row.expert.fullName} /> },
                  { id: 'referred', header: 'Referred', cell: (row) => formatDate(row.referredAt) },
                  { id: 'link', header: 'Link status', cell: (row) => <LinkStatusBadge status={row.linkStatus} /> },
                  { id: 'caseStatus', header: 'Case status', cell: (row) => <CaseStatusBadge status={row.caseStatus} /> },
                  { id: 'suspected', header: 'Suspected', cell: (row) => row.observation.suspectedDisease.name },
                  { id: 'confirmed', header: 'Confirmed', cell: (row) => (row.diagnosis ? <Badge tone="success">{row.diagnosis.disease.name}</Badge> : <Badge tone="neutral">Not yet confirmed</Badge>) },
                ]}
              />
            </Card>
            {selected && (
              <div className={styles.split}>
                <Card title={`${selected.id} progress`}>
                  <Timeline label={`${selected.id} progress`} items={progress(selected)} />
                </Card>
                <Card title="Suspected vs confirmed">
                  {notice && (
                    <Banner tone="info" onDismiss={() => setNotice(false)}>
                      Suspected disease comes from the field. Confirmed disease is recorded only by an expert diagnosis.
                    </Banner>
                  )}
                  <div className={styles.evidenceMeta}>
                    <Fields
                      items={[
                        { label: 'Suspected (field)', value: `${selected.observation.suspectedDisease.name} (${selected.observation.suspectedDisease.id})` },
                        {
                          label: 'Confirmed (expert)',
                          value: selected.diagnosis ? <Badge tone="success">{`${selected.diagnosis.disease.name} (${selected.diagnosis.disease.id})`}</Badge> : 'Not yet confirmed',
                        },
                        { label: 'Catalog version', value: selected.observation.catalogVersion },
                        { label: 'Statement', value: selected.diagnosis?.statement ?? 'Awaiting expert diagnosis' },
                      ]}
                    />
                  </div>
                </Card>
              </div>
            )}
          </div>
        )
      }}
    </QueryBoundary>
  )
}

function progress(referral: Referral): TimelineItem[] {
  const items: TimelineItem[] = [{ id: 'referred', title: 'Referred by supervisor', detail: `${formatDateTime(referral.referredAt)} · ${referral.referredBy.fullName}`, state: 'done' }]
  if (referral.linkStatus === 'linked' && referral.caseId) {
    items.push({ id: 'case', title: `Case created: ${referral.caseId}`, detail: `${referral.caseCreatedAt ? formatDateTime(referral.caseCreatedAt) : 'Date not recorded'} · linked to referral`, state: 'done' })
  } else {
    items.push({ id: 'case', title: 'Waiting for case link', detail: 'No case exists yet · reconciliation in progress', state: 'open' })
  }
  if (referral.diagnosis) {
    items.push({ id: 'diagnosis', title: `Diagnosis confirmed: ${referral.diagnosis.id}`, detail: `${formatDateTime(referral.diagnosis.at)} · ${referral.expert.fullName}`, state: 'done' })
  } else {
    items.push({ id: 'diagnosis', title: 'Diagnosis pending', detail: 'Recorded only after an expert creates a diagnosis', state: 'open' })
  }
  return items
}
