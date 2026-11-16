import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { Badge, Banner, Button, ButtonLink, Card, DataTable, DescriptionList, EmptyState, IconButton, Modal, PageHeader, Timeline, usePageBreadcrumbs, useToast } from '@/shared/components'
import type { CaptureObservation } from '../domain/observation'
import { useObservation, useWorkspace } from './services'
import { Boundary } from './common'
import { dateTime, failure, observationPath } from './helpers'
import { EvidenceImage } from './EvidenceImage'
import { RevisionComparison } from './RevisionComparison'
import { changeSummary } from '../domain/revision'
import { downloadEvidence } from './downloadEvidence'
import contour1 from './assets/contour-1.svg'
import contour2 from './assets/contour-2.svg'
import contour3 from './assets/contour-3.svg'
import accuracy from './assets/accuracy.svg'
import pin from './assets/map-pin.svg'
import styles from './capture.module.css'

export type ObservationView = 'details' | 'evidence' | 'original' | 'metadata' | 'gps' | 'revisions' | 'compare'
const titles: Record<ObservationView, string> = { details: 'Observation Details', evidence: 'Observation Evidence Viewer', original: 'Original Image Viewer', metadata: 'Capture Metadata', gps: 'GPS Provenance Details', revisions: 'Observation Revision History', compare: 'Original vs Revised Evidence' }

export function CaptureEntryPage() {
  const query = useWorkspace()
  return <Boundary query={query}>{(data) => {
    const observation = data.observations.find((row) => row.evidence) ?? data.observations.find((row) => row.id === 'OBS-002') ?? data.observations[0]
    return observation ? <Navigate to={observationPath(observation.id, 'evidence')} replace /> : <EmptyState title="No observations in your estate scope" message="No observation evidence is available for this account." />
  }}</Boundary>
}

export function ObservationPage({ view }: { view: ObservationView }) {
  const { observationId = '' } = useParams()
  const query = useObservation(observationId)
  usePageBreadcrumbs([{ label: 'Capture', to: '/observations' }, { label: observationId, to: observationPath(observationId) }, { label: titles[view] }])
  return <Boundary query={query}>{(observation) => <ObservationView key={`${observation.id}-${view}`} observation={observation} view={view} />}</Boundary>
}

function ObservationView({ observation: o, view }: { observation: CaptureObservation; view: ObservationView }) {
  const toast = useToast()
  const workspace = useWorkspace()
  const [params, setParams] = useSearchParams()
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [revision, setRevision] = useState(1)
  const [downloading, setDownloading] = useState(false)
  const e = o.evidence
  // Every submitted revision, oldest first. Earlier revisions are never changed by a correction.
  const revisions = o.revisions
  const latest = revisions[revisions.length - 1]
  const hasRevision = revisions.length > 1
  const shown = revisions.find((item) => item.number === revision) ?? revisions[0]
  const revisionNote = (number: number) => {
    const current = revisions.find((item) => item.number === number)
    const previous = revisions.find((item) => item.number === number - 1)
    if (!current || !previous) return null
    return `${current.photo?.imageId === previous.photo?.imageId ? 'Original evidence unchanged. ' : 'New photograph submitted. '}${changeSummary(previous, current)}.`
  }
  const originAssignment = workspace.data?.assignments.find((a) => a.id === params.get('assignment') && a.observationIds.includes(o.id))
  const contextQuery = originAssignment ? `?assignment=${encodeURIComponent(originAssignment.id)}` : ''
  const unavailable = !e || failed || params.get('state') === 'unavailable'
  const gps = e ? `${e.latitude.toFixed(3)}, ${e.longitude.toFixed(3)} · ±${o.gpsAccuracyM} m` : 'Coordinates not provided in this fixture'
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); toast.show({ tone: 'success', title: `${label} copied` }) }
    catch { toast.show({ tone: 'error', title: 'Copy failed', message: 'Clipboard access is unavailable. The values remain visible on this page.' }) }
  }
  async function download() {
    setDownloading(true)
    try { await downloadEvidence(e?.imageId) } catch (error) { toast.show({ tone: 'error', title: 'Download failed', message: failure(error) }) }
    finally { setDownloading(false) }
  }
  function retryImage() {
    setFailed(false); setRetry((count) => count + 1)
    setParams((previous) => { const next = new URLSearchParams(previous); next.delete('state'); return next }, { replace: true })
    if (!e) toast.show({ tone: 'info', title: 'Evidence fixture unavailable', message: 'No detailed evidence asset has been specified for this observation.' })
  }
  const buttonLink = (tab: string, label: string) => <ButtonLink variant="secondary" to={observationPath(o.id, tab) + contextQuery}>{label}</ButtonLink>
  const tools = <div className={styles.actions}>
    <IconButton appearance="plain" className={styles.tool} icon="minus" label="Zoom out" disabled={zoom <= 50} onClick={() => setZoom((value) => Math.max(50, value - 25))} />
    <IconButton appearance="plain" className={styles.tool} icon="plus" label="Zoom in" disabled={zoom >= 300} onClick={() => setZoom((value) => Math.min(300, value + 25))} />
    <IconButton appearance="plain" className={styles.tool} icon="rotate" label="Rotate image" onClick={() => setRotation((value) => (value + 90) % 360)} />
    <IconButton appearance="plain" className={styles.tool} icon="expand" label="Expand image" onClick={() => setExpanded(true)} />
    <IconButton appearance="plain" className={styles.tool} icon="download" label="Download original" onClick={() => void download()} disabled={downloading} />
    <output aria-label="Zoom level">{zoom}%</output>
  </div>
  const provenance = <DescriptionList columns={2} items={[
    { label: 'Image ID', value: e?.imageId ?? 'Not specified' }, { label: 'MIME type', value: e?.mimeType ?? 'Not specified' },
    { label: 'Captured by', value: `${o.fieldWorker.fullName} (${o.fieldWorker.id})` }, { label: 'Captured', value: dateTime(o.capturedAt) },
    { label: 'Received', value: e ? dateTime(e.receivedAt) : 'Not specified' },
    { label: 'GPS', value: <Link className={styles.link} to={observationPath(o.id, 'gps')}>{gps}</Link> },
    { label: 'Mobile sync', value: <Badge tone="info">Synced</Badge> }, { label: 'Review status', value: <Badge tone="warning">{o.reviewStatus.replaceAll('_', ' ')}</Badge> },
  ]} />
  const image = <EvidenceImage key={retry} label={`${e?.imageId} \u00b7 original.jpg`} altText={e?.altText} zoom={zoom} rotation={rotation} onError={() => setFailed(true)} />
  const missing = <Card><div className={styles.unavailable}><h2>Evidence unavailable</h2><p>The image URL is not available in this demo fixture. This is not a data loss; the original asset remains immutable.</p></div><div className={styles.actions}>
    <Button onClick={retryImage}>Retry loading</Button><Button variant="secondary" onClick={() => void copy(`Evidence display problem: ${o.id}\n${e?.assetKey ?? 'No asset fixture'}\n${gps}`, 'Problem details')}>Report a problem</Button>
  </div></Card>
  const viewerFailed = unavailable && (view === 'evidence' || view === 'original')
  const headerActions = viewerFailed ? <Button icon="refresh" onClick={retryImage}>Retry loading</Button> : view === 'metadata' ? <Button variant="secondary" onClick={() => void copy(JSON.stringify(o, null, 2), 'Metadata')}>Copy metadata</Button> : view === 'gps' ? <Button variant="secondary" disabled={!e} onClick={() => void copy(gps, 'Coordinates')}>Copy coordinates</Button> : view === 'compare' ? buttonLink('revisions', 'Back to history') : view === 'revisions' ? hasRevision && buttonLink('compare', 'Compare revisions') : view === 'details' ? <>{buttonLink('evidence', 'Open evidence')}<ButtonLink to={`/review/observations/${o.id}`}>Go to review</ButtonLink></> : view === 'original' ? <>{o.id === 'OBS-005' && <Button variant="secondary" onClick={() => setParams((previous) => { const next = new URLSearchParams(previous); next.set('state', 'unavailable'); return next })}>Demo state: evidence unavailable</Button>}<Button variant="secondary" loading={downloading} onClick={() => void download()}>Download original</Button></> : <>{hasRevision && buttonLink('compare', 'Compare revisions')}{buttonLink('original', 'Open original')}</>
  return <div className={styles.page}>
    <PageHeader title={viewerFailed ? 'Evidence Unavailable' : titles[view]} subtitle={`${o.id} · ${o.division.name} (${o.division.id}) · ${o.estate.name}`} back={{ to: view === 'evidence' && originAssignment ? `/assignments/${originAssignment.id}` : observationPath(o.id, ['details', 'original'].includes(view) ? 'evidence' : '') + contextQuery, label: view === 'evidence' && originAssignment ? 'Back to assignment' : ['details', 'original'].includes(view) ? 'Back to evidence viewer' : 'Back to observation' }} actions={<div className={styles.actions}>{headerActions}</div>} />
    {view === 'details' && <nav aria-label="Observation sections" className={styles.actions}>{[['', 'Overview'], ['evidence', 'Evidence'], ['metadata', 'Metadata'], ['revisions', 'Revisions']].map(([tab, label]) => <Link className={styles.link} key={tab} to={observationPath(o.id, tab)} aria-current={tab === '' ? 'page' : undefined}>{label}</Link>)}</nav>}
    {viewerFailed ? <><Banner tone="error">The evidence image could not be loaded. Metadata and provenance remain available below.</Banner><div className={styles.split}>{missing}<Card title="Still available">{provenance}<DescriptionList items={[{ label: 'Asset key', value: e?.assetKey ?? 'Not specified' }, { label: 'Immutable', value: e ? 'Yes' : 'Not specified' }]} /></Card></div></> :
      view === 'evidence' ? <div className={styles.split}><Card><div className={styles.toolbar}><Badge tone="success">Original preserved · immutable</Badge>{tools}</div>{image}<div className={styles.thumbs}>{revisions.map(({ number, photo }) => <button key={number} type="button" className={styles.thumb} aria-pressed={revision === number} onClick={() => setRevision(number)}><EvidenceImage thumbnail label={photo?.imageId ?? e?.imageId} altText={photo?.altText ?? e?.altText} onError={() => setFailed(true)} /><p>Revision {number} · {number === 1 ? 'original' : number === latest.number ? 'latest' : 'superseded'}</p></button>)}</div>{shown.number > 1 && <p className={styles.muted}>{revisionNote(shown.number)}</p>}</Card><Card title="Evidence provenance">{provenance}</Card></div> :
      view === 'original' ? <div className={styles.original}><div className={styles.toolbar}><Badge tone="success">Original · read-only</Badge>{tools}</div>{image}<p className={styles.muted}>Synthetic fixture illustration and download; not real uploaded evidence.</p><p className={styles.muted}>Captured {dateTime(o.capturedAt)} · GPS ±{o.gpsAccuracyM} m · Catalog v{o.catalogVersion} · Immutable asset: {e?.assetKey}</p></div> :
      view === 'details' ? <div className={styles.overview}><Card title="Original evidence">{e && !failed ? image : <EmptyState title="Evidence unavailable" message="No detailed evidence fixture is available." />}<p className={styles.muted}>{e?.altText ?? 'Observation metadata remains available.'}</p>{e && <Badge tone="success">Original preserved · immutable</Badge>}</Card><div className={styles.stack}><Card title="Observation summary"><DescriptionList columns={3} items={[
        { label: 'Observation ID', value: o.id }, { label: 'Device observation', value: o.deviceObservationId }, { label: 'Estate', value: `${o.estate.name} (${o.estate.id})` }, { label: 'Division', value: `${o.division.name} (${o.division.id})` }, { label: 'Captured by', value: o.fieldWorker.fullName }, { label: 'Catalog version', value: o.catalogVersion }, { label: 'Mobile sync status', value: <Badge tone="info">Synced</Badge> }, { label: 'Review status', value: o.reviewStatus.replaceAll('_', ' ') }, { label: 'Latest revision', value: hasRevision ? `${latest.number} (${latest.id})` : '1 (original)' },
      ]} /></Card><Card title="Suspected disease and symptoms"><div className={styles.actions}><Badge tone="warning">Suspected: {o.suspectedDisease.name} ({o.suspectedDisease.id})</Badge><Badge tone="neutral">Not a confirmed diagnosis</Badge></div>{latest.symptoms.length > 0 && <p>{latest.symptoms.join(' · ')}</p>}{latest.note && <p className={styles.muted}>Field note{hasRevision ? ` (version ${latest.number})` : ''}: {latest.note}</p>}</Card><Card title="Linked records">{hasRevision ? <DataTable caption="Linked records" rows={[{ kind: 'Review', id: o.id.replace('OBS-', 'REV-'), state: o.reviewStatus.replaceAll('_', ' '), to: `/review/observations/${o.id}` }, ...revisions.slice(1).flatMap((item) => [{ kind: 'Correction request', id: item.correctionId ?? '', state: `Answered by revision ${item.number}`, to: `/review/corrections/${item.correctionId}` }, { kind: 'Revision', id: item.id, state: item.number === latest.number ? 'Latest' : 'Superseded', to: observationPath(o.id, 'revisions') }])]} rowKey={(row) => row.id} columns={[{ id: 'kind', header: 'Record', cell: (row) => row.kind }, { id: 'id', header: 'ID', cell: (row) => <Link to={row.to}>{row.id}</Link> }, { id: 'state', header: 'State', cell: (row) => <Badge tone="info">{row.state}</Badge> }]} /> : <p className={styles.muted}>No linked Capture records specified.</p>}</Card></div></div> :
      view === 'metadata' ? <div className={styles.equal}><Card title="Capture and device"><DescriptionList columns={2} items={[
        { label: 'Observation ID', value: o.id }, { label: 'Device observation ID', value: o.deviceObservationId }, { label: 'Captured at', value: `${dateTime(o.capturedAt)} (+05:30)` }, { label: 'Received at', value: e ? `${dateTime(e.receivedAt)} (+05:30)` : 'Not specified' }, { label: 'Captured by', value: `${o.fieldWorker.fullName} (${o.fieldWorker.id})` }, { label: 'Division scope', value: `${o.division.id} ${o.division.name}` }, { label: 'Catalog version', value: o.catalogVersion }, { label: 'Sync status', value: <Badge tone="info">Synced</Badge> },
      ]} /></Card><Card title="Asset and server receipt">{e ? <DescriptionList items={[{ label: 'Image ID', value: e.imageId }, { label: 'Asset key', value: e.assetKey }, { label: 'MIME type', value: e.mimeType }, { label: 'Immutable', value: <Badge tone="success">Yes</Badge> }, { label: 'Sync receipt', value: e.syncReceipt ? `${e.syncReceipt} \u00b7 acknowledged` : 'Not specified' }, { label: 'Server receipt', value: dateTime(e.receivedAt) }, { label: 'Idempotency key', value: e.idempotencyKey ?? 'Not specified' }, { label: 'Alt text', value: e.altText }]} /> : <EmptyState title="Detailed receipt unavailable" message="This observation has no approved receipt fixture." />}</Card></div> :
      view === 'gps' ? <div className={styles.split}><Card>{e ? <div className={styles.map} role="img" aria-label={`Demo map: ${gps}`}><img src={contour1} className={styles.contour1} alt="" /><img src={contour2} className={styles.contour2} alt="" /><img src={contour3} className={styles.contour3} alt="" /><img src={accuracy} className={styles.accuracy} alt="" /><img src={pin} className={styles.pin} alt="" /><span className={styles.mapLabel}>{gps}</span><span className={styles.mapNote}>Demo map · no live tiles</span></div> : <EmptyState title="Coordinates unavailable" message="GPS accuracy alone does not establish latitude or longitude." />}</Card><div className={styles.stack}><Card title="Provenance"><DescriptionList columns={2} items={[{ label: 'Latitude', value: e?.latitude.toFixed(3) ?? 'Not specified' }, { label: 'Longitude', value: e?.longitude.toFixed(3) ?? 'Not specified' }, { label: 'Accuracy', value: `±${o.gpsAccuracyM} m` }, { label: 'Source', value: e ? 'device_gps' : 'Not specified' }, { label: 'Division', value: `${o.division.id} ${o.division.name}` }, { label: 'Editable on web', value: 'No' }]} /></Card><Card title="Accuracy band"><div className={styles.band} /><div className={styles.bandLabels}><span>0 m</span><span>15 m</span><span>30 m</span></div><p>This observation: ±{o.gpsAccuracyM} m</p></Card><Card title={`Other observations in ${o.division.id}`}><Boundary query={workspace}>{(data) => <DataTable caption="Division GPS accuracy" rows={data.observations.filter((row) => row.division.id === o.division.id)} rowKey={(row) => row.id} columns={[{ id: 'id', header: 'Observation', cell: (row) => <Link to={observationPath(row.id, 'gps')}>{row.id}</Link> }, { id: 'accuracy', header: 'Accuracy', cell: (row) => `±${row.gpsAccuracyM} m` }]} />}</Boundary></Card></div></div> :
      !hasRevision ? <EmptyState title="No corrected revisions" message="Only the original submission (revision 1) exists for this observation." action={buttonLink('metadata', 'View metadata')} /> :
      view === 'revisions' ? <><div className={styles.history}><Card title="Timeline"><Timeline label="Revision history" items={revisions.flatMap((item) => [
        ...(item.correctionId ? [{ id: `${item.id}-request`, title: `Correction requested (${item.correctionId})`, detail: `on revision ${item.number - 1}`, state: 'done' as const }] : []),
        { id: item.id, title: item.number === 1 ? 'Revision 1 received' : `Revision ${item.number} resubmitted (${item.id})`, detail: `${dateTime(item.submittedAt)} · ${item.submittedBy.fullName}${item.number === 1 ? ' · original submission' : ''}`, state: 'done' as const },
      ])} /></Card><Card title="Revisions"><DataTable caption="Revisions" rows={revisions} rowKey={(row) => row.id} columns={[{ id: 'number', header: 'Revision', cell: (row) => row.number }, { id: 'id', header: 'ID', cell: (row) => row.id }, { id: 'state', header: 'Status', cell: (row) => <Badge tone={row.number === latest.number ? 'teal' : 'neutral'}>{row.number === latest.number ? 'Latest' : 'Superseded'}</Badge> }, { id: 'submitted', header: 'Submitted', cell: (row) => dateTime(row.submittedAt) }, { id: 'changes', header: 'Changes', cell: (row) => changeSummary(revisions.find((item) => item.number === row.number - 1), row) }, { id: 'correction', header: 'Answers correction', cell: (row) => row.correctionId ? <Link className={styles.link} to={`/review/corrections/${row.correctionId}`}>{row.correctionId}</Link> : '—' }]} /><DescriptionList items={[{ label: 'Latest revision', value: `${latest.number} (${latest.id})` }, { label: 'Current review status', value: o.reviewStatus.replaceAll('_', ' ') }]} /></Card></div></> :
      <Card title="Revision comparison"><RevisionComparison revisions={revisions} currentNumber={latest.number} currentLabel="Latest revision" /><p className={styles.muted}>Synthetic fixture illustrations; not real uploaded evidence.</p></Card>}
    <Modal open={expanded} title="Expanded evidence image" size="large" onClose={() => setExpanded(false)}>{image}</Modal>
  </div>
}
