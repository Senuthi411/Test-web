import type {
  FixtureDatabase,
  FixtureDiagnosisDetails,
  FixtureReferral,
  FixtureStore,
  FixtureUser,
} from '@/fixtures'
import { projectRevision, revisionsOf } from '@/fixtures'
import { AppError } from '@/shared/api'
import type { Clock } from '@/shared/utilities/clock'
import type { CasesPort } from '../application/ports'
import type {
  AiConversationThread,
  CaseDiagnosisRecord,
  CaseEvidenceRevision,
  CaseHistoryEntry,
  CasePersonRef,
  CaseRecord,
  CaseSeverity,
  CaseStatus,
  CaseTimelineEvent,
  CasesNotificationItem,
  CasesWorkspace,
  CatalogDiseaseDetail,
  CatalogSymptom,
  CatalogVersionRecord,
  DiseaseCategory,
} from '../domain/models'
import { canCloseDiagnosedCase, canRecordCaseDiagnosis, computeCatalogDiseaseDiff } from '../domain/rules'

export interface FixtureCasesOptions {
  clock: Clock
  actorId: () => string | null
}

type ReadDb = Readonly<FixtureDatabase>

interface CasesInternalState {
  activeCatalogVersion: number
  symptoms: CatalogSymptom[]
  diseaseMetadata: Record<
    string,
    {
      summary: string
      diagnosticCriteria: string
      differentialDiagnosis: string
      treatmentGuidance: string
      favorableConditions: string
      typicalSeverity: CaseSeverity
      symptomIds: string[]
      updatedAt: string
      updatedBy: string
      draftChanges: CatalogDiseaseDetail['draftChanges']
    }
  >
  draftNewDiseases: CatalogDiseaseDetail[]
  catalogVersions: CatalogVersionRecord[]
  pendingReferrals: Array<{
    referralId: string
    observationId: string
    estateId: string
    divisionId: string
    referredBy: string
    expertId: string
    referredAt: string
    note: string
    linkedCaseId: string | null
  }>
  caseVersions: Record<string, number>
  idempotencyKeys: Set<string>
  aiThreads: AiConversationThread[]
  notifications: CasesNotificationItem[]
}

const storeStateMap = new WeakMap<FixtureStore, CasesInternalState>()

function localIso(date: Date): string {
  const local = new Date(date.getTime() + 5.5 * 3600 * 1000)
  return `${local.toISOString().slice(0, 19)}+05:30`
}

const INITIAL_SYMPTOMS: CatalogSymptom[] = [
  {
    id: 'SYM-001',
    name: 'Raised translucent blister-like patches',
    plantPart: 'Young flush leaf',
    description: 'Translucent pale-yellow or pinkish circular spots on tender flush leaves that swell into concave upper-surface indentations and convex lower-surface white spore blisters.',
    progressionStage: 'Early',
    linkedDiseaseIds: ['DIS-001'],
    status: 'active',
  },
  {
    id: 'SYM-002',
    name: 'Concentric grey necrotic rings with black acervuli',
    plantPart: 'Mature leaf',
    description: 'Zonate brown-to-silvery-grey necrotic lesions starting at leaf margins or wounds, dotted with minute black fruiting bodies (acervuli) arranged in concentric rings.',
    progressionStage: 'Intermediate',
    linkedDiseaseIds: ['DIS-002'],
    status: 'active',
  },
  {
    id: 'SYM-003',
    name: 'Reddish-brown coalescing marginal lesions',
    plantPart: 'Leaf margin & apex',
    description: 'Yellowish-brown water-soaked marginal patches that darken to chocolate or reddish-brown with a sharp chlorotic halo and dark sub-epidermal perithecia.',
    progressionStage: 'Intermediate',
    linkedDiseaseIds: ['DIS-003', 'DIS-002'],
    status: 'active',
  },
  {
    id: 'SYM-004',
    name: 'Velvety rust-orange algal thallus discs',
    plantPart: 'Upper & lower epidermis',
    description: 'Raised circular or lobed greenish-grey to rusty-orange velvety cushions (2–8 mm) growing epiphytically on the upper cuticle of older shaded leaves.',
    progressionStage: 'Advanced',
    linkedDiseaseIds: ['DIS-004'],
    status: 'active',
  },
  {
    id: 'SYM-005',
    name: 'Interveinal chlorosis & yellow margin halo',
    plantPart: 'Young flush leaf',
    description: 'Diffuse yellowing between primary veins or surrounding expanding fungal lesions prior to tissue necrosis.',
    progressionStage: 'Early',
    linkedDiseaseIds: ['DIS-001', 'DIS-002', 'DIS-003'],
    status: 'active',
  },
  {
    id: 'SYM-006',
    name: 'White hymenial spore coat on lower lamina',
    plantPart: 'Upper & lower epidermis',
    description: 'Dense white velvety basidiospore layer covering the convex lower blister surface during high humidity and mist conditions.',
    progressionStage: 'Intermediate',
    linkedDiseaseIds: ['DIS-001'],
    status: 'active',
  },
  {
    id: 'SYM-007',
    name: 'Premature defoliation & shoot dieback',
    plantPart: 'Stem & petiole',
    description: 'Severe lesion coalescence across the petiole and tender internodes causing leaf drop and dieback of pluckable shoots.',
    progressionStage: 'Advanced',
    linkedDiseaseIds: ['DIS-001', 'DIS-003', 'DIS-005'],
    status: 'draft',
  },
]

function createInitialState(): CasesInternalState {
  const meta: CasesInternalState['diseaseMetadata'] = {
    'DIS-001': {
      summary: 'Obligate biotrophic basidiomycete affecting young tender tea flush during cool, misty monsoon periods.',
      diagnosticCriteria: 'Concave upper leaf depression with corresponding white powdery convex lower-surface blister (SYM-001, SYM-006) on 1st–3rd flush leaves.',
      differentialDiagnosis: 'Distinguished from Grey blight (DIS-002) and Brown blight (DIS-003) by restriction to young flush and absence of black acervuli.',
      treatmentGuidance: 'Shorten plucking rounds to 5–7 days; apply copper oxychloride + hexaconazole spray across mist-prone upper terraces.',
      favorableConditions: 'Relative humidity > 85%, temperature 15–22°C, prolonged morning mist (> 4 hours) and dense shade canopy.',
      typicalSeverity: 'High',
      symptomIds: ['SYM-001', 'SYM-005', 'SYM-006', 'SYM-007'],
      updatedAt: '2026-10-12T10:30:00+05:30',
      updatedBy: 'Dr Tara Wijesinghe',
      draftChanges: null,
    },
    'DIS-002': {
      summary: 'Common necrotrophic foliar fungus attacking mature maintenance foliage and sun-scorched or mechanically injured leaves.',
      diagnosticCriteria: 'Silvery-grey zonate lesions with concentric rings of black pin-head acervuli (SYM-002) and yellow border halo (SYM-005).',
      differentialDiagnosis: 'Unlike Brown blight (DIS-003), mature lesions turn distinctly ash-grey in the center with visible concentric acervuli under 10× lens.',
      treatmentGuidance: 'Prune heavily necrotic branches, sanitize plucking shears, improve potassium nutrition, and apply mancozeb or carbendazim foliar protectant.',
      favorableConditions: 'Warm humid afternoons (24–29°C), sun-scorch stress, or mechanical wounding after mechanical harvesting.',
      typicalSeverity: 'Moderate',
      symptomIds: ['SYM-002', 'SYM-003', 'SYM-005'],
      updatedAt: '2026-10-18T14:20:00+05:30',
      updatedBy: 'Dr Tara Wijesinghe',
      draftChanges: {
        targetVersion: 3,
        updatedAt: '2026-10-20T16:40:00+05:30',
        updatedBy: 'Dr Tara Wijesinghe',
        note: 'Added petiole dieback symptom SYM-007 and refined shear sanitation threshold for v3 release.',
        proposed: {
          name: 'Grey blight',
          pathogen: 'Pestalotiopsis theae',
          category: 'Fungal',
          summary: 'Common necrotrophic foliar fungus attacking mature maintenance foliage, mechanically sheared shoots, and sun-stressed leaves.',
          diagnosticCriteria: 'Silvery-grey zonate lesions with concentric rings of black pin-head acervuli (SYM-002), chlorotic halo (SYM-005), and occasional petiole necrosis (SYM-007).',
          differentialDiagnosis: 'Unlike Brown blight (DIS-003), mature lesions turn distinctly ash-grey in the center with visible concentric acervuli under 10× lens.',
          treatmentGuidance: 'Prune heavily necrotic branches, disinfect plucking shears between blocks, balance K2O soil application, and apply mancozeb or systemic triazole protectant.',
          symptomIds: ['SYM-002', 'SYM-003', 'SYM-005', 'SYM-007'],
        },
        diffs: computeCatalogDiseaseDiff(
          {
            name: 'Grey blight',
            pathogen: 'Pestalotiopsis theae',
            category: 'Fungal',
            summary: 'Common necrotrophic foliar fungus attacking mature maintenance foliage and sun-scorched or mechanically injured leaves.',
            diagnosticCriteria: 'Silvery-grey zonate lesions with concentric rings of black pin-head acervuli (SYM-002) and yellow border halo (SYM-005).',
            differentialDiagnosis: 'Unlike Brown blight (DIS-003), mature lesions turn distinctly ash-grey in the center with visible concentric acervuli under 10× lens.',
            treatmentGuidance: 'Prune heavily necrotic branches, sanitize plucking shears, improve potassium nutrition, and apply mancozeb or carbendazim foliar protectant.',
            symptomIds: ['SYM-002', 'SYM-003', 'SYM-005'],
          },
          {
            name: 'Grey blight',
            pathogen: 'Pestalotiopsis theae',
            category: 'Fungal',
            summary: 'Common necrotrophic foliar fungus attacking mature maintenance foliage, mechanically sheared shoots, and sun-stressed leaves.',
            diagnosticCriteria: 'Silvery-grey zonate lesions with concentric rings of black pin-head acervuli (SYM-002), chlorotic halo (SYM-005), and occasional petiole necrosis (SYM-007).',
            differentialDiagnosis: 'Unlike Brown blight (DIS-003), mature lesions turn distinctly ash-grey in the center with visible concentric acervuli under 10× lens.',
            treatmentGuidance: 'Prune heavily necrotic branches, disinfect plucking shears between blocks, balance K2O soil application, and apply mancozeb or systemic triazole protectant.',
            symptomIds: ['SYM-002', 'SYM-003', 'SYM-005', 'SYM-007'],
          },
        ),
      },
    },
    'DIS-003': {
      summary: 'Anthracnose-group foliar pathogen causing dark reddish-brown marginal and apical necrosis on semi-mature and mature tea leaves.',
      diagnosticCriteria: 'Chocolate to reddish-brown coalescing lesions starting at leaf tips/margins (SYM-003) with a distinct yellow transition zone (SYM-005).',
      differentialDiagnosis: 'Lesions remain dark reddish-brown rather than turning silvery-grey as in Grey blight (DIS-002), and lack white convex lower blisters of Blister blight (DIS-001).',
      treatmentGuidance: 'Remove infected foliage during skiffing, improve air circulation and drainage in humid pockets, and apply copper-based or strobilurin fungicide where threshold is exceeded.',
      favorableConditions: 'Persistent rainfall, poor drainage, temperatures 22–28°C, and nitrogen-heavy fertilization.',
      typicalSeverity: 'Moderate',
      symptomIds: ['SYM-003', 'SYM-005', 'SYM-007'],
      updatedAt: '2026-10-14T11:15:00+05:30',
      updatedBy: 'Dr Tara Wijesinghe',
      draftChanges: null,
    },
    'DIS-004': {
      summary: 'Parasitic green alga forming velvety rust-colored cushions on older tea foliage in over-shaded, poorly ventilated divisions.',
      diagnosticCriteria: 'Circular raised velvety orange-rust thallus discs on the upper leaf surface (SYM-004) that leave superficial bark or cuticle scarring.',
      differentialDiagnosis: 'Readily distinguished from fungal blights by its raised fuzzy orange-red sporangiophore carpet on the upper epidermis.',
      treatmentGuidance: 'Lop excess shade-tree branches to increase sunlight penetration, prune bush skirts for airflow, and apply Bordeaux mixture or copper oxychloride post-pruning.',
      favorableConditions: 'Excessive shade (> 60%), stagnant humid air, and waterlogged lower-valley microclimates.',
      typicalSeverity: 'Low',
      symptomIds: ['SYM-004'],
      updatedAt: '2026-10-10T09:00:00+05:30',
      updatedBy: 'Dr Tara Wijesinghe',
      draftChanges: null,
    },
  }

  const draftDis005: CatalogDiseaseDetail = {
    id: 'DIS-005',
    name: 'Red rust stem & foliar blight',
    pathogen: 'Cephaleuros parasiticus',
    category: 'Algal',
    catalogVersion: 3,
    status: 'draft',
    summary: 'Draft v3 catalog entry covering stem-penetrating algal red rust observed on young clonal tea shoots in low-elevation river valleys.',
    diagnosticCriteria: 'Brick-red filamentous sporangial patches on one-year-old green stems accompanied by variegated chlorosis and shoot dieback (SYM-004, SYM-007).',
    differentialDiagnosis: 'Differentiated from epiphytic Algal leaf spot (DIS-004) by deeper sub-cuticular stem lesions and terminal shoot dieback.',
    treatmentGuidance: 'Improve potassium and magnesium bush vigor, regulate shade density, and apply copper oxychloride spray during dormant flush intervals.',
    favorableConditions: 'High water table, compacted soil, and dense low-canopy shade.',
    typicalSeverity: 'Moderate',
    symptomIds: ['SYM-004', 'SYM-007'],
    symptoms: INITIAL_SYMPTOMS.filter((s) => ['SYM-004', 'SYM-007'].includes(s.id)),
    referenceImages: [
      {
        id: 'REFIMG-005-1',
        caption: 'Stem & petiole red rust cushion · Stage 2',
        stage: 'Intermediate',
        sourceAttribution: 'Synthetic botanical reference plate · TeaLeaf Catalog v3 Draft',
        assetLabel: 'CAT-DIS-005 · ref-1.svg',
      },
    ],
    linkedCaseIds: [],
    updatedAt: '2026-10-20T17:10:00+05:30',
    updatedBy: 'Dr Tara Wijesinghe',
    draftChanges: null,
  }

  return {
    activeCatalogVersion: 2,
    symptoms: structuredClone(INITIAL_SYMPTOMS),
    diseaseMetadata: meta,
    draftNewDiseases: [draftDis005],
    catalogVersions: [
      {
        version: 3,
        status: 'Draft',
        publishedAt: null,
        publishedBy: 'Dr Tara Wijesinghe',
        diseaseCount: 5,
        symptomCount: 7,
        releaseNotes: 'Draft v3 adds Red rust stem & foliar blight (DIS-005), symptom SYM-007, and updated Grey blight (DIS-002) shear sanitation criteria.',
        changesSummary: [
          'Added draft disease DIS-005 (Red rust stem & foliar blight)',
          'Added draft symptom SYM-007 (Premature defoliation & shoot dieback)',
          'Modified DIS-002 (Grey blight) diagnostic criteria and shear sanitation guidance',
        ],
      },
      {
        version: 2,
        status: 'Active',
        publishedAt: '2026-10-01T08:30:00+05:30',
        publishedBy: 'Dr Tara Wijesinghe',
        diseaseCount: 4,
        symptomCount: 6,
        releaseNotes: 'Active October 2026 monsoon catalog v2. Refined concentric acervuli criteria for DIS-002 and copper spray intervals for DIS-001.',
        changesSummary: [
          'Updated DIS-002 (Grey blight) differential diagnosis against DIS-003',
          'Standardized symptom taxonomy SYM-001 through SYM-006',
        ],
      },
      {
        version: 1,
        status: 'Published',
        publishedAt: '2026-08-15T09:00:00+05:30',
        publishedBy: 'Dr Tara Wijesinghe',
        diseaseCount: 4,
        symptomCount: 5,
        releaseNotes: 'Initial baseline TeaLeaf Field Scout Disease Catalog (DIS-001 to DIS-004).',
        changesSummary: ['Baseline release of DIS-001, DIS-002, DIS-003, and DIS-004'],
      },
    ],
    pendingReferrals: [
      {
        referralId: 'REF-099',
        observationId: 'OBS-015',
        estateId: 'EST-002',
        divisionId: 'DIV-006',
        referredBy: 'USR-003',
        expertId: 'USR-005',
        referredAt: '2026-10-21T08:15:00+05:30',
        note: 'Verified West Terrace observation OBS-015 shows ambiguous reddish-brown vs silvery-grey marginal lesions; requesting case creation and expert confirmation.',
        linkedCaseId: null,
      },
    ],
    caseVersions: {},
    idempotencyKeys: new Set<string>(),
    aiThreads: [
      {
        id: 'AI-THR-001',
        title: 'CASE-023 · Brown blight vs Grey blight differential',
        updatedAt: '2026-10-21T08:45:00+05:30',
        contextBadge: 'CASE-023 · OBS-023 · DIS-003',
        messages: [
          {
            id: 'AIM-001',
            role: 'user',
            createdAt: '2026-10-21T08:44:00+05:30',
            content: 'Compare the observed marginal lesions on CASE-023 (OBS-023, East Hills DIV-005) against Brown blight (DIS-003) and Grey blight (DIS-002).',
            attachedContext: { caseId: 'CASE-023', observationId: 'OBS-023', diseaseId: 'DIS-003' },
            citations: [],
            isDegradedFallback: false,
          },
          {
            id: 'AIM-002',
            role: 'assistant',
            createdAt: '2026-10-21T08:45:00+05:30',
            content:
              'Advisory Comparison for CASE-023 (OBS-023):\n\n1. Symptom Alignment with Brown blight (DIS-003): Field worker Hiruni Nadeesha recorded reddish-brown coalescing marginal lesions (SYM-003) and yellow margin halo (SYM-005) in East Hills (DIV-005). In Catalog v2, chocolate-to-reddish-brown lesions without silvery-grey central bleaching strongly favor Colletotrichum species (DIS-003).\n2. Exclusion of Grey blight (DIS-002): Check the 10× macro crop of IMG-023 for concentric rings of black pin-head acervuli (SYM-002). If concentric acervuli are absent and necrosis remains dark reddish-brown, Grey blight is less likely.\n3. Advisory Recommendation: Inspect the official final revision in the Evidence viewer before recording your confirmed diagnosis. This assistant is advisory only and never modifies case status.',
            attachedContext: { caseId: 'CASE-023', observationId: 'OBS-023', diseaseId: 'DIS-003' },
            citations: [
              {
                code: 'DIS-003 · v2',
                title: 'Brown blight (Colletotrichum species)',
                version: 'Catalog v2 (Active)',
                excerpt: 'Chocolate to reddish-brown coalescing lesions starting at leaf tips/margins (SYM-003) with a distinct yellow transition zone (SYM-005).',
              },
              {
                code: 'DIS-002 · v2',
                title: 'Grey blight (Pestalotiopsis theae)',
                version: 'Catalog v2 (Active)',
                excerpt: 'Silvery-grey zonate lesions with concentric rings of black pin-head acervuli (SYM-002) and yellow border halo (SYM-005).',
              },
            ],
            isDegradedFallback: false,
          },
        ],
      },
      {
        id: 'AI-THR-002',
        title: 'CASE-011 · High-altitude Blister blight treatment window',
        updatedAt: '2026-10-20T15:20:00+05:30',
        contextBadge: 'CASE-011 · OBS-011 · DIS-001',
        messages: [
          {
            id: 'AIM-003',
            role: 'user',
            createdAt: '2026-10-20T15:19:00+05:30',
            content: 'What is the catalog v2 containment protocol for suspected Blister blight on Central Terrace (DIV-002) in CASE-011?',
            attachedContext: { caseId: 'CASE-011', observationId: 'OBS-011', diseaseId: 'DIS-001' },
            citations: [],
            isDegradedFallback: false,
          },
          {
            id: 'AIM-004',
            role: 'assistant',
            createdAt: '2026-10-20T15:20:00+05:30',
            content:
              'Advisory Protocol for CASE-011 (Central Terrace, Highland Tea Estate EST-001):\n\n• Diagnostic Verification: Confirm concave upper leaf indentation and white velvety lower-surface basidiospore blister (SYM-001, SYM-006) on 1st–3rd flush leaves.\n• Recommended Action (Catalog v2): Shorten plucking rounds to 5–7 days to remove susceptible tender flush and apply copper oxychloride + hexaconazole protectant across mist-prone upper terraces.\n• Follow-up Window: Schedule a 7-day post-spray re-inspection focusing on shaded North/Central terrace boundaries.',
            attachedContext: { caseId: 'CASE-011', observationId: 'OBS-011', diseaseId: 'DIS-001' },
            citations: [
              {
                code: 'DIS-001 · v2',
                title: 'Blister blight (Exobasidium vexans)',
                version: 'Catalog v2 (Active)',
                excerpt: 'Shorten plucking rounds to 5–7 days; apply copper oxychloride + hexaconazole spray across mist-prone upper terraces.',
              },
            ],
            isDegradedFallback: false,
          },
        ],
      },
    ],
    notifications: [
      {
        id: 'NTF-001',
        title: 'CASE-023 awaiting expert diagnosis',
        detail: 'Referred by Malini Fernando · East Hills (DIV-005) · Suspected Brown blight',
        at: '2026-10-21T08:30:00+05:30',
        unread: true,
        category: 'Referral',
        to: '/cases/CASE-023',
      },
      {
        id: 'NTF-002',
        title: 'REF-099 pending case link',
        detail: 'Observation OBS-015 referred from West Terrace (DIV-006) · Ready to link case',
        at: '2026-10-21T08:15:00+05:30',
        unread: true,
        category: 'Referral',
        to: '/cases/referrals/REF-099',
      },
      {
        id: 'NTF-003',
        title: 'Catalog v3 draft changes staged',
        detail: 'DIS-002 (Grey blight) diff & DIS-005 draft ready for review and publication',
        at: '2026-10-20T17:10:00+05:30',
        unread: false,
        category: 'Catalog',
        to: '/cases/catalog/DIS-002',
      },
    ],
  }
}

export function getOrCreateCasesState(store: FixtureStore): CasesInternalState {
  let state = storeStateMap.get(store)
  if (!state) {
    state = createInitialState()
    storeStateMap.set(store, state)
  }
  return state
}

function deterministicSha256(seed: string): string {
  let h1 = 0xdeadbeef ^ seed.length
  let h2 = 0x41c6ce57 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  return `${hex(h1)}${hex(h2)}${hex(h1 ^ 0x5a5a5a5a)}${hex(h2 ^ 0x3c3c3c3c)}${hex(h1 + h2)}${hex(h1 ^ h2)}${hex(h1 * 3)}${hex(h2 * 7)}`
}

export function createFixtureCasesAdapter(store: FixtureStore, options: FixtureCasesOptions): CasesPort {
  const now = () => localIso(options.clock.now())

  const actorOf = (db: ReadDb): FixtureUser => {
    const id = options.actorId()
    if (!id) throw new AppError('unauthorized', 'Sign in as a Disease Expert to access Cases.')
    const actor = db.users.find((u) => u.id === id)
    if (!actor || actor.status !== 'active' || actor.role !== 'DISEASE_EXPERT') {
      throw new AppError('forbidden', 'Only active Disease Experts can access the Cases & Disease Catalog workspace.')
    }
    return actor
  }

  const person = (db: ReadDb, userId: string): CasePersonRef => {
    const u = db.users.find((item) => item.id === userId)
    return { id: userId, fullName: u?.fullName ?? userId, role: u?.role }
  }

  const buildDiseaseCatalog = (db: ReadDb, state: CasesInternalState): CatalogDiseaseDetail[] => {
    const activeAndInactive: CatalogDiseaseDetail[] = db.diseases.map((d) => {
      const m = state.diseaseMetadata[d.id] ?? {
        summary: `${d.name} (${d.pathogen}) foliar disease record.`,
        diagnosticCriteria: 'Standard foliar visual and microscopic confirmation.',
        differentialDiagnosis: 'Compare against primary fungal and algal tea blights.',
        treatmentGuidance: 'Follow estate integrated disease management guidelines.',
        favorableConditions: 'High humidity and monsoon mist.',
        typicalSeverity: 'Moderate' as CaseSeverity,
        symptomIds: ['SYM-001'],
        updatedAt: '2026-10-15T10:00:00+05:30',
        updatedBy: 'Dr Tara Wijesinghe',
        draftChanges: null,
      }
      const linkedCases = db.referrals
        .filter((r) => r.caseId && (r.diagnosis?.diseaseId === d.id || db.observations.find((o) => o.id === r.observationId)?.suspectedDiseaseId === d.id))
        .map((r) => r.caseId!)
      return {
        id: d.id,
        name: d.name,
        pathogen: d.pathogen,
        category: (d.category as DiseaseCategory) ?? 'Fungal',
        catalogVersion: d.catalogVersion,
        status: d.status === 'active' ? 'active' : 'inactive',
        summary: m.summary,
        diagnosticCriteria: m.diagnosticCriteria,
        differentialDiagnosis: m.differentialDiagnosis,
        treatmentGuidance: m.treatmentGuidance,
        favorableConditions: m.favorableConditions,
        typicalSeverity: m.typicalSeverity,
        symptomIds: [...m.symptomIds],
        symptoms: state.symptoms.filter((s) => m.symptomIds.includes(s.id)),
        referenceImages: [
          {
            id: `REFIMG-${d.id}-1`,
            caption: `${d.name} · Early foliar lesion stage`,
            stage: 'Early stage',
            sourceAttribution: 'Synthetic leaf illustration · TeaLeaf Approved Catalog Plate',
            assetLabel: `CAT-${d.id} · early-stage.svg`,
          },
          {
            id: `REFIMG-${d.id}-2`,
            caption: `${d.name} · Mature diagnostic stage (10× reference)`,
            stage: 'Mature stage',
            sourceAttribution: 'Synthetic leaf illustration · TeaLeaf Approved Catalog Plate',
            assetLabel: `CAT-${d.id} · mature-stage.svg`,
          },
        ],
        linkedCaseIds: [...new Set(linkedCases)],
        updatedAt: m.updatedAt,
        updatedBy: m.updatedBy,
        draftChanges: m.draftChanges ? structuredClone(m.draftChanges) : null,
      }
    })

    return [...activeAndInactive, ...structuredClone(state.draftNewDiseases)]
  }

  const projectCaseRecord = (db: ReadDb, state: CasesInternalState, referral: FixtureReferral): CaseRecord => {
    const observation = db.observations.find((o) => o.id === referral.observationId)
    if (!observation) throw new AppError('contract_mismatch', `Observation ${referral.observationId} not found.`)
    const division = db.divisions.find((d) => d.id === observation.divisionId)
    const estate = db.estates.find((e) => e.id === division?.estateId)
    const suspected = db.diseases.find((d) => d.id === observation.suspectedDiseaseId) ?? db.diseases[0]
    if (!division || !estate || !suspected) {
      throw new AppError('contract_mismatch', `Incomplete location or disease references for ${referral.id}.`)
    }

    const rawRevisions = revisionsOf(db, observation.id)
    const captureRevs = rawRevisions.map((r) => projectRevision(db, r))

    // For CASE-023 (OBS-023), provide a 2-revision history (Original V1 + Corrected Official Final V2) so the
    // Expert can inspect Original vs Corrected/Official Final revisions in the Evidence & Compare tabs!
    const evidenceRevisions: CaseEvidenceRevision[] =
      observation.id === 'OBS-023' && rawRevisions.length === 1
        ? [
            {
              revisionId: 'OBSR-023-1',
              revisionNumber: 1,
              label: 'Revision 1 · Original submission',
              statusBadge: 'Original',
              isOfficialFinal: false,
              imageId: 'IMG-023-V1',
              assetKey: 'demo/observations/OBS-023/v1-original.jpg',
              mimeType: 'image/jpeg',
              sha256: deterministicSha256('OBS-023-V1-IMG-023'),
              capturedAt: observation.capturedAt,
              receivedAt: observation.capturedAt,
              submittedBy: person(db, observation.fieldWorkerId),
              latitude: 7.018,
              longitude: 80.662,
              gpsAccuracyM: 14,
              symptoms: ['Reddish-brown coalescing marginal lesions', 'Yellowing or chlorosis'],
              fieldNote: 'Initial field capture on East Hills terrace 2; partial motion blur on lower leaf margin.',
            },
            {
              revisionId: 'OBSR-023-2',
              revisionNumber: 2,
              label: 'Revision 2 · Corrected & Official Final',
              statusBadge: 'Official final',
              isOfficialFinal: true,
              imageId: 'IMG-023',
              assetKey: 'demo/observations/OBS-023/v2-official-final.jpg',
              mimeType: 'image/jpeg',
              sha256: deterministicSha256('OBS-023-V2-IMG-023-FINAL'),
              capturedAt: '2026-10-05T11:20:00+05:30',
              receivedAt: '2026-10-05T11:24:00+05:30',
              submittedBy: person(db, observation.fieldWorkerId),
              latitude: 7.0184,
              longitude: 80.6623,
              gpsAccuracyM: observation.gpsAccuracyM,
              symptoms: ['Reddish-brown coalescing marginal lesions', 'Interveinal chlorosis & yellow margin halo'],
              fieldNote: 'Retaken macro angle of East Hills block B leaf margin showing distinct reddish-brown border and yellow halo without silvery-grey acervuli.',
            },
          ]
        : rawRevisions.map((rev, idx) => {
            const isLatest = idx === rawRevisions.length - 1
            const imgId = rev.values.imageId ?? observation.id.replace('OBS-', 'IMG-')
            return {
              revisionId: rev.id,
              revisionNumber: rev.number,
              label: `Revision ${rev.number} · ${rev.number === 1 ? 'Original submission' : 'Corrected resubmission'}`,
              statusBadge: isLatest ? 'Official final' : 'Original',
              isOfficialFinal: isLatest,
              imageId: imgId,
              assetKey: `demo/observations/${observation.id}/v${rev.number}.jpg`,
              mimeType: 'image/jpeg',
              sha256: deterministicSha256(`${observation.id}-${rev.id}-${imgId}`),
              capturedAt: observation.capturedAt,
              receivedAt: rev.submittedAt,
              submittedBy: person(db, rev.submittedBy),
              latitude: rev.values.latitude ?? 7.018,
              longitude: rev.values.longitude ?? 80.662,
              gpsAccuracyM: rev.values.gpsAccuracyM ?? observation.gpsAccuracyM,
              symptoms: [...rev.values.symptoms],
              fieldNote: rev.values.note ?? 'No field note recorded.',
            }
          })

    const latestRev = evidenceRevisions[evidenceRevisions.length - 1]

    const confirmedDiseaseObj = referral.diagnosis
      ? db.diseases.find((d) => d.id === referral.diagnosis?.diseaseId) ??
        state.draftNewDiseases.find((d) => d.id === referral.diagnosis?.diseaseId)
      : null

    let status: CaseStatus = 'awaiting_diagnosis'
    if (referral.linkStatus === 'pending_case_link' || !referral.caseId) {
      status = 'pending_link'
    } else if (referral.diagnosis) {
      status = referral.diagnosis.details?.caseStatus === 'Closed' ? 'closed' : 'diagnosed'
    }

    const diagnosisRecord: CaseDiagnosisRecord | null =
      referral.diagnosis && confirmedDiseaseObj && referral.caseId
        ? {
            id: referral.diagnosis.id,
            caseId: referral.caseId,
            referralId: referral.id,
            observationId: observation.id,
            confirmedDisease: {
              id: confirmedDiseaseObj.id,
              name: confirmedDiseaseObj.name,
              pathogen: confirmedDiseaseObj.pathogen,
              category: (confirmedDiseaseObj.category as DiseaseCategory) ?? 'Fungal',
            },
            suspectedDisease: {
              id: suspected.id,
              name: suspected.name,
            },
            catalogVersionPinned: referral.diagnosis.details?.catalogVersion ?? observation.catalogVersion,
            severity: (referral.diagnosis.details?.severity as CaseSeverity) ?? 'Moderate',
            symptomsConfirmed: referral.diagnosis.details?.symptomsConfirmed
              ? referral.diagnosis.details.symptomsConfirmed.split(/[,;]\s*/).filter(Boolean)
              : [...latestRev.symptoms],
            clinicalFindings: referral.diagnosis.details?.clinicalFindings ?? referral.diagnosis.statement,
            reasoning:
              referral.diagnosis.details?.reasoning ??
              'Confirmed from official final leaf evidence and catalog diagnostic criteria.',
            recommendedAction:
              referral.diagnosis.details?.recommendedAction ??
              'Apply targeted foliar sanitation and monitor division perimeter.',
            followUpPlan: referral.diagnosis.details?.followUpDescription
              ? {
                  priority: referral.diagnosis.details.severity === 'High' || referral.diagnosis.details.severity === 'Critical' ? 'P1' : 'P2',
                  description: referral.diagnosis.details.followUpDescription,
                  monitoringWindow: referral.diagnosis.details.monitoringWindow || '7 days',
                  inspectionFocus: referral.diagnosis.details.inspectionFocus || 'Adjacent terrace rows',
                }
              : null,
            recordedBy: person(db, referral.diagnosis.details?.recordedBy ?? referral.expertId),
            diagnosedAt: referral.diagnosis.at,
            closedAt: referral.diagnosis.details?.closedAt ?? null,
            caseStatus: referral.diagnosis.details?.caseStatus ?? 'Diagnosed',
          }
        : null

    const timeline: CaseTimelineEvent[] = [
      {
        id: `${referral.id}-TL-1`,
        at: observation.capturedAt,
        title: `Field observation ${observation.id} captured`,
        actor: person(db, observation.fieldWorkerId).fullName,
        actorRole: 'FIELD_WORKER',
        category: 'Capture',
        detail: `Captured in ${division.name} (${division.id}) · Suspected ${suspected.name} (${suspected.id}) · GPS ±${observation.gpsAccuracyM} m`,
        badgeTone: 'neutral',
      },
      ...(evidenceRevisions.length > 1
        ? [
            {
              id: `${referral.id}-TL-1B`,
              at: latestRev.receivedAt,
              title: `Official final evidence revision V${latestRev.revisionNumber} verified`,
              actor: person(db, referral.referredBy).fullName,
              actorRole: 'SUPERVISOR',
              category: 'Review' as const,
              detail: `Revision ${latestRev.revisionId} (${latestRev.imageId}) marked as official final evidence.`,
              badgeTone: 'teal' as const,
            },
          ]
        : []),
      {
        id: `${referral.id}-TL-2`,
        at: referral.referredAt,
        title: `Supervisor referral ${referral.id} created`,
        actor: person(db, referral.referredBy).fullName,
        actorRole: 'SUPERVISOR',
        category: 'Referral',
        detail: referral.note ?? 'Referred to Disease Expert for diagnostic confirmation.',
        badgeTone: 'warning',
      },
    ]

    if (referral.caseId && referral.caseCreatedAt) {
      timeline.push({
        id: `${referral.id}-TL-3`,
        at: referral.caseCreatedAt,
        title: `Case ${referral.caseId} linked & assigned`,
        actor: person(db, referral.expertId).fullName,
        actorRole: 'DISEASE_EXPERT',
        category: 'Case',
        detail: `Linked ${referral.id} -> ${referral.caseId} · Assigned to ${person(db, referral.expertId).fullName}`,
        badgeTone: 'teal',
      })
    }

    if (diagnosisRecord) {
      timeline.push({
        id: `${referral.id}-TL-4`,
        at: diagnosisRecord.diagnosedAt,
        title: `Official diagnosis recorded (${diagnosisRecord.id})`,
        actor: diagnosisRecord.recordedBy.fullName,
        actorRole: 'DISEASE_EXPERT',
        category: 'Diagnosis',
        detail: `Confirmed ${diagnosisRecord.confirmedDisease.name} (${diagnosisRecord.confirmedDisease.id}) · Severity: ${diagnosisRecord.severity} · Pinned to Catalog v${diagnosisRecord.catalogVersionPinned}`,
        badgeTone: 'success',
      })
      if (diagnosisRecord.closedAt) {
        timeline.push({
          id: `${referral.id}-TL-5`,
          at: diagnosisRecord.closedAt,
          title: `Case ${referral.caseId} closed`,
          actor: diagnosisRecord.recordedBy.fullName,
          actorRole: 'DISEASE_EXPERT',
          category: 'Case',
          detail: 'Diagnostic workflow completed and follow-up guidance transmitted to Supervisor.',
          badgeTone: 'neutral',
        })
      }
    }

    const recordKey = referral.caseId ?? referral.id
    return {
      id: recordKey,
      caseId: referral.caseId,
      referralId: referral.id,
      observationId: observation.id,
      status,
      version: state.caseVersions[recordKey] ?? 1,
      estate: { id: estate.id, name: estate.name },
      division: { id: division.id, name: division.name },
      fieldWorker: person(db, observation.fieldWorkerId),
      referredBy: person(db, referral.referredBy),
      assignedExpert: person(db, referral.expertId),
      capturedAt: observation.capturedAt,
      referredAt: referral.referredAt,
      caseCreatedAt: referral.caseCreatedAt,
      referralNote: referral.note ?? 'Referred for specialist disease confirmation.',
      suspectedDisease: {
        id: suspected.id,
        name: suspected.name,
        pathogen: suspected.pathogen,
        category: (suspected.category as DiseaseCategory) ?? 'Fungal',
      },
      confirmedDisease: diagnosisRecord ? diagnosisRecord.confirmedDisease : null,
      catalogVersion: diagnosisRecord ? diagnosisRecord.catalogVersionPinned : state.activeCatalogVersion,
      gpsAccuracyM: latestRev.gpsAccuracyM,
      latitude: latestRev.latitude,
      longitude: latestRev.longitude,
      observedSymptoms: latestRev.symptoms,
      fieldNote: latestRev.fieldNote,
      revisions: evidenceRevisions,
      captureRevisions: captureRevs,
      diagnosis: diagnosisRecord,
      timeline,
    }
  }

  const projectPendingSyntheticReferral = (
    db: ReadDb,
    state: CasesInternalState,
    pending: CasesInternalState['pendingReferrals'][number],
  ): CaseRecord => {
    const asReferral: FixtureReferral = {
      id: pending.referralId,
      observationId: pending.observationId,
      expertId: pending.expertId,
      referredBy: pending.referredBy,
      referredAt: pending.referredAt,
      note: pending.note,
      linkStatus: pending.linkedCaseId ? 'linked' : 'pending_case_link',
      caseId: pending.linkedCaseId,
      caseCreatedAt: pending.linkedCaseId ? '2026-10-21T09:00:00+05:30' : null,
      caseStatus: pending.linkedCaseId ? 'awaiting_diagnosis' : null,
      diagnosis: null,
      provenance: 'fixture-assigned',
    }
    return projectCaseRecord(db, state, asReferral)
  }

  const buildScopedCases = (db: ReadDb, actor: FixtureUser, state: CasesInternalState): CaseRecord[] => {
    const estateOfObs = (obsId: string) => {
      const obs = db.observations.find((o) => o.id === obsId)
      return db.divisions.find((d) => d.id === obs?.divisionId)?.estateId ?? null
    }

    const fromDbReferrals = db.referrals
      .filter((r) => actor.estateIds.includes(estateOfObs(r.observationId) ?? ''))
      .map((r) => projectCaseRecord(db, state, r))

    const existingReferralIds = new Set(fromDbReferrals.map((r) => r.referralId))
    const fromPending = state.pendingReferrals
      .filter((p) => !existingReferralIds.has(p.referralId) && actor.estateIds.includes(p.estateId))
      .map((p) => projectPendingSyntheticReferral(db, state, p))

    return [...fromDbReferrals, ...fromPending].sort((a, b) => {
      const order: Record<CaseStatus, number> = {
        awaiting_diagnosis: 0,
        pending_link: 1,
        diagnosed: 2,
        closed: 3,
      }
      return order[a.status] - order[b.status] || b.referredAt.localeCompare(a.referredAt)
    })
  }

  const buildHistory = (cases: CaseRecord[]): CaseHistoryEntry[] =>
    cases
      .filter((c) => (c.status === 'diagnosed' || c.status === 'closed') && c.diagnosis && c.caseId)
      .map((c) => {
        const d = c.diagnosis!
        const refMs = new Date(c.referredAt.includes('T') ? c.referredAt : `${c.referredAt}T09:00:00+05:30`).getTime()
        const diagMs = new Date(d.diagnosedAt.includes('T') ? d.diagnosedAt : `${d.diagnosedAt}T14:00:00+05:30`).getTime()
        const hours = Math.max(2, Math.round(Math.abs(diagMs - refMs) / 3_600_000))
        return {
          id: d.id,
          caseId: c.caseId!,
          referralId: c.referralId,
          observationId: c.observationId,
          estate: c.estate,
          division: c.division,
          suspectedDisease: { id: c.suspectedDisease.id, name: c.suspectedDisease.name },
          confirmedDisease: { id: d.confirmedDisease.id, name: d.confirmedDisease.name },
          category: d.confirmedDisease.category,
          severity: d.severity,
          catalogVersion: d.catalogVersionPinned,
          expert: d.recordedBy,
          referredBy: c.referredBy,
          referredAt: c.referredAt,
          diagnosedAt: d.diagnosedAt,
          closedAt: d.closedAt,
          turnaroundHours: hours,
          status: d.caseStatus,
          clinicalSummary: d.clinicalFindings,
          recommendedAction: d.recommendedAction,
        }
      })
      .sort((a, b) => b.diagnosedAt.localeCompare(a.diagnosedAt))

  const buildWorkspace = (db: ReadDb, actor: FixtureUser, state: CasesInternalState): CasesWorkspace => {
    const cases = buildScopedCases(db, actor, state)
    const diseases = buildDiseaseCatalog(db, state)
    const history = buildHistory(cases)
    const awaitingDiagnosisCount = cases.filter((c) => c.status === 'awaiting_diagnosis').length
    const diagnosedCount = cases.filter((c) => c.status === 'diagnosed' || c.status === 'closed').length
    const pendingLinkCount = cases.filter((c) => c.status === 'pending_link').length
    const avgDiagnosisHours =
      history.length > 0 ? Math.round(history.reduce((sum, item) => sum + item.turnaroundHours, 0) / history.length) : 14
    const draftVersion = state.catalogVersions.find((v) => v.status === 'Draft')?.version ?? null

    return {
      actor: { id: actor.id, fullName: actor.fullName, role: actor.role },
      estates: db.estates
        .filter((e) => actor.estateIds.includes(e.id))
        .map((e) => ({ id: e.id, name: e.name })),
      divisions: db.divisions
        .filter((d) => actor.estateIds.includes(d.estateId))
        .map((d) => ({ id: d.id, name: d.name, estateId: d.estateId })),
      cases,
      diseases,
      symptoms: structuredClone(state.symptoms),
      catalogVersions: structuredClone(state.catalogVersions),
      history,
      aiThreads: structuredClone(state.aiThreads),
      notifications: structuredClone(state.notifications),
      kpis: {
        awaitingDiagnosisCount,
        diagnosedCount,
        pendingLinkCount,
        avgDiagnosisHours,
        activeCatalogVersion: state.activeCatalogVersion,
        draftCatalogVersion: draftVersion,
      },
    }
  }

  return {
    getWorkspace(signal) {
      return store.run(
        () =>
          store.read((db) => {
            const actor = actorOf(db)
            const state = getOrCreateCasesState(store)
            return buildWorkspace(db, actor, state)
          }),
        signal,
      )
    },

    getCase(caseOrReferralId, signal) {
      return store.run(
        () =>
          store.read((db) => {
            const actor = actorOf(db)
            const state = getOrCreateCasesState(store)
            const normalized = caseOrReferralId.trim().toUpperCase()

            // Explicit Estate Scope Guard: CASE-091 or CASE-018 in EST-003 (Mist Valley) are out of scope for Dr Tara Wijesinghe (EST-001, EST-002).
            if (normalized === 'CASE-091' || normalized === 'CASE-018' || normalized === 'REF-018') {
              if (!actor.estateIds.includes('EST-003')) {
                throw new AppError(
                  'forbidden',
                  `Access Denied (403): ${normalized} belongs to Mist Valley Tea Estate (EST-003), which is outside your assigned estate scope (${actor.estateIds.join(', ')}).`,
                )
              }
            }

            const cases = buildScopedCases(db, actor, state)
            const found = cases.find(
              (c) =>
                c.id.toUpperCase() === normalized ||
                c.caseId?.toUpperCase() === normalized ||
                c.referralId.toUpperCase() === normalized ||
                c.observationId.toUpperCase() === normalized,
            )

            if (!found) {
              throw new AppError(
                'not_found',
                `Case or referral "${caseOrReferralId}" was not found in your assigned estates.`,
              )
            }
            return found
          }),
        signal,
      )
    },

    getDisease(diseaseId, signal) {
      return store.run(
        () =>
          store.read((db) => {
            actorOf(db)
            const state = getOrCreateCasesState(store)
            const diseases = buildDiseaseCatalog(db, state)
            const found = diseases.find((d) => d.id.toUpperCase() === diseaseId.trim().toUpperCase())
            if (!found) {
              throw new AppError('not_found', `Disease "${diseaseId}" was not found in the Disease Catalog.`)
            }
            return found
          }),
        signal,
      )
    },

    linkPendingReferral(referralId, meta) {
      return store.run(() =>
        store.write((db) => {
          const actor = actorOf(db)
          const state = getOrCreateCasesState(store)
          const normalized = referralId.trim().toUpperCase()

          // Check synthetic pending referral (e.g., REF-099) or db.referrals with pending_case_link
          const dbReferral = db.referrals.find((r) => r.id.toUpperCase() === normalized)
          const pendingSynthetic = state.pendingReferrals.find((p) => p.referralId.toUpperCase() === normalized)

          if (state.idempotencyKeys.has(meta.idempotencyKey)) {
            const existing = buildScopedCases(db, actor, state).find((c) => c.referralId.toUpperCase() === normalized)
            if (existing) return existing
          }

          if (dbReferral) {
            if (dbReferral.linkStatus === 'linked' && dbReferral.caseId) {
              throw new AppError('conflict', `Referral ${dbReferral.id} is already linked to ${dbReferral.caseId}.`)
            }
            const newCaseId = dbReferral.observationId.replace('OBS-', 'CASE-')
            dbReferral.linkStatus = 'linked'
            dbReferral.caseId = newCaseId
            dbReferral.caseCreatedAt = now()
            dbReferral.caseStatus = 'awaiting_diagnosis'
            state.idempotencyKeys.add(meta.idempotencyKey)
            state.caseVersions[newCaseId] = 1
            return projectCaseRecord(db, state, dbReferral)
          }

          if (pendingSynthetic) {
            if (pendingSynthetic.linkedCaseId) {
              throw new AppError('conflict', `Referral ${pendingSynthetic.referralId} is already linked to ${pendingSynthetic.linkedCaseId}.`)
            }
            const newCaseId = pendingSynthetic.referralId === 'REF-099' ? 'CASE-099' : pendingSynthetic.observationId.replace('OBS-', 'CASE-')
            pendingSynthetic.linkedCaseId = newCaseId
            state.idempotencyKeys.add(meta.idempotencyKey)
            state.caseVersions[newCaseId] = 1
            return projectPendingSyntheticReferral(db, state, pendingSynthetic)
          }

          throw new AppError('not_found', `Pending referral "${referralId}" was not found.`)
        }),
      )
    },

    recordDiagnosis(caseId, input, meta) {
      return store.run(() =>
        store.write((db) => {
          const actor = actorOf(db)
          const state = getOrCreateCasesState(store)
          const normalized = caseId.trim().toUpperCase()

          const referral = db.referrals.find(
            (r) => r.caseId?.toUpperCase() === normalized || r.id.toUpperCase() === normalized,
          )
          if (!referral || !referral.caseId) {
            throw new AppError('not_found', `Case "${caseId}" was not found or is not yet linked.`)
          }

          const observation = db.observations.find((o) => o.id === referral.observationId)
          const estateId = db.divisions.find((d) => d.id === observation?.divisionId)?.estateId ?? null
          if (!observation || !estateId || !actor.estateIds.includes(estateId)) {
            throw new AppError('forbidden', 'You cannot record a diagnosis for a case outside your assigned estate scope.')
          }

          if (state.idempotencyKeys.has(meta.idempotencyKey)) {
            return projectCaseRecord(db, state, referral)
          }

          const currentVersion = state.caseVersions[referral.caseId] ?? 1
          if (meta.expectedVersion !== currentVersion) {
            throw new AppError('conflict', `Case ${referral.caseId} was modified by another session. Refresh before submitting.`)
          }

          const currentCase = projectCaseRecord(db, state, referral)
          if (!canRecordCaseDiagnosis(currentCase.status)) {
            throw new AppError(
              'conflict',
              `Cannot record diagnosis: ${referral.caseId} is already ${currentCase.status.replace('_', ' ')}.`,
            )
          }

          const disease = db.diseases.find((d) => d.id === input.diseaseId && d.status === 'active')
          if (!disease) {
            throw new AppError('validation', 'Select an active disease from the published Disease Catalog.', {
              details: [{ path: 'diseaseId', message: 'Only active catalog diseases can be confirmed' }],
            })
          }

          const timestamp = now()
          const diagId = referral.caseId.replace('CASE-', 'DIAG-')
          referral.caseStatus = 'diagnosed'
          referral.diagnosis = {
            id: diagId,
            diseaseId: disease.id,
            at: timestamp,
            statement: input.clinicalFindings,
            details: {
              severity: input.severity as FixtureDiagnosisDetails['severity'],
              symptomsConfirmed: input.symptomsConfirmed.join(', '),
              clinicalFindings: input.clinicalFindings,
              reasoning: input.reasoning,
              recommendedAction: input.recommendedAction,
              followUpDescription: input.followUpDescription,
              monitoringWindow: input.monitoringWindow,
              inspectionFocus: input.inspectionFocus,
              catalogVersion: state.activeCatalogVersion,
              caseStatus: input.closeCase ? 'Closed' : 'Diagnosed',
              closedAt: input.closeCase ? timestamp : null,
              recordedBy: actor.id,
            },
          }

          if (!db.cases.some((c) => c.id === referral.caseId)) {
            db.cases.push({
              id: referral.caseId,
              observationId: observation.id,
              status: 'confirmed',
              provenance: 'fixture-assigned',
            })
          }

          state.caseVersions[referral.caseId] = currentVersion + 1
          state.idempotencyKeys.add(meta.idempotencyKey)
          state.notifications.unshift({
            id: `NTF-${Date.now()}`,
            title: `Diagnosis ${diagId} confirmed for ${referral.caseId}`,
            detail: `${disease.name} (${disease.id}) · Pinned to Catalog v${state.activeCatalogVersion}`,
            at: timestamp,
            unread: true,
            category: 'Diagnosis',
            to: `/cases/${referral.caseId}`,
          })

          return projectCaseRecord(db, state, referral)
        }),
      )
    },

    closeCase(caseId, meta) {
      return store.run(() =>
        store.write((db) => {
          actorOf(db)
          const state = getOrCreateCasesState(store)
          const normalized = caseId.trim().toUpperCase()
          const referral = db.referrals.find((r) => r.caseId?.toUpperCase() === normalized)
          if (!referral || !referral.caseId) {
            throw new AppError('not_found', `Case "${caseId}" was not found.`)
          }

          if (state.idempotencyKeys.has(meta.idempotencyKey)) {
            return projectCaseRecord(db, state, referral)
          }

          const currentCase = projectCaseRecord(db, state, referral)
          if (!canCloseDiagnosedCase(currentCase.status) || !referral.diagnosis?.details) {
            throw new AppError('conflict', `Only a diagnosed case can be closed (current status: ${currentCase.status}).`)
          }

          referral.diagnosis.details.caseStatus = 'Closed'
          referral.diagnosis.details.closedAt = now()
          state.caseVersions[referral.caseId] = (state.caseVersions[referral.caseId] ?? 1) + 1
          state.idempotencyKeys.add(meta.idempotencyKey)

          return projectCaseRecord(db, state, referral)
        }),
      )
    },

    saveCatalogDraft(input, meta) {
      return store.run(() =>
        store.write((db) => {
          const actor = actorOf(db)
          const state = getOrCreateCasesState(store)
          void meta
          const timestamp = now()
          const targetVersion = state.activeCatalogVersion + 1

          if (input.diseaseId) {
            const existingDbDisease = db.diseases.find((d) => d.id === input.diseaseId)
            if (existingDbDisease) {
              const currentMeta = state.diseaseMetadata[existingDbDisease.id]
              const diffs = computeCatalogDiseaseDiff(
                {
                  name: existingDbDisease.name,
                  pathogen: existingDbDisease.pathogen,
                  category: existingDbDisease.category,
                  summary: currentMeta?.summary ?? '',
                  diagnosticCriteria: currentMeta?.diagnosticCriteria ?? '',
                  differentialDiagnosis: currentMeta?.differentialDiagnosis ?? '',
                  treatmentGuidance: currentMeta?.treatmentGuidance ?? '',
                  symptomIds: currentMeta?.symptomIds ?? [],
                },
                {
                  name: input.name,
                  pathogen: input.pathogen,
                  category: input.category,
                  summary: input.summary,
                  diagnosticCriteria: input.diagnosticCriteria,
                  differentialDiagnosis: input.differentialDiagnosis,
                  treatmentGuidance: input.treatmentGuidance,
                  symptomIds: input.symptomIds,
                },
              )

              state.diseaseMetadata[existingDbDisease.id] = {
                ...(currentMeta ?? {
                  summary: input.summary,
                  diagnosticCriteria: input.diagnosticCriteria,
                  differentialDiagnosis: input.differentialDiagnosis,
                  treatmentGuidance: input.treatmentGuidance,
                  favorableConditions: 'High humidity and monsoon mist.',
                  typicalSeverity: 'Moderate',
                  symptomIds: input.symptomIds,
                  updatedAt: timestamp,
                  updatedBy: actor.fullName,
                }),
                draftChanges: {
                  targetVersion,
                  updatedAt: timestamp,
                  updatedBy: actor.fullName,
                  note: input.note || `Staged draft changes for Catalog v${targetVersion}`,
                  proposed: {
                    name: input.name,
                    pathogen: input.pathogen,
                    category: input.category,
                    summary: input.summary,
                    diagnosticCriteria: input.diagnosticCriteria,
                    differentialDiagnosis: input.differentialDiagnosis,
                    treatmentGuidance: input.treatmentGuidance,
                    symptomIds: [...input.symptomIds],
                  },
                  diffs,
                },
              }
              return buildDiseaseCatalog(db, state).find((d) => d.id === existingDbDisease.id)!
            }
          }

          // New draft disease entry
          const nextNum = db.diseases.length + state.draftNewDiseases.length + 1
          const newId = input.diseaseId || `DIS-${String(nextNum).padStart(3, '0')}`
          const draftDisease: CatalogDiseaseDetail = {
            id: newId,
            name: input.name,
            pathogen: input.pathogen,
            category: input.category,
            catalogVersion: targetVersion,
            status: 'draft',
            summary: input.summary,
            diagnosticCriteria: input.diagnosticCriteria,
            differentialDiagnosis: input.differentialDiagnosis,
            treatmentGuidance: input.treatmentGuidance,
            favorableConditions: 'Moist shaded microclimate.',
            typicalSeverity: 'Moderate',
            symptomIds: [...input.symptomIds],
            symptoms: state.symptoms.filter((s) => input.symptomIds.includes(s.id)),
            referenceImages: [
              {
                id: `REFIMG-${newId}-1`,
                caption: `${input.name} · Draft reference plate`,
                stage: 'Draft plate',
                sourceAttribution: 'Synthetic leaf illustration · TeaLeaf Draft Catalog Plate',
                assetLabel: `CAT-${newId} · draft.svg`,
              },
            ],
            linkedCaseIds: [],
            updatedAt: timestamp,
            updatedBy: actor.fullName,
            draftChanges: null,
          }

          const existingDraftIdx = state.draftNewDiseases.findIndex((d) => d.id === newId)
          if (existingDraftIdx >= 0) {
            state.draftNewDiseases[existingDraftIdx] = draftDisease
          } else {
            state.draftNewDiseases.push(draftDisease)
          }

          return draftDisease
        }),
      )
    },

    publishCatalogVersion(input, meta) {
      return store.run(() =>
        store.write((db) => {
          const actor = actorOf(db)
          const state = getOrCreateCasesState(store)
          void meta
          const timestamp = now()
          const newVersion = state.activeCatalogVersion + 1

          // Apply staged draft changes on existing active diseases
          for (const d of db.diseases) {
            const m = state.diseaseMetadata[d.id]
            if (m?.draftChanges) {
              const p = m.draftChanges.proposed
              d.name = p.name
              d.pathogen = p.pathogen
              d.category = p.category === 'Algal' ? 'Algal' : 'Fungal'
              m.summary = p.summary
              m.diagnosticCriteria = p.diagnosticCriteria
              m.differentialDiagnosis = p.differentialDiagnosis
              m.treatmentGuidance = p.treatmentGuidance
              m.symptomIds = [...p.symptomIds]
              m.updatedAt = timestamp
              m.updatedBy = actor.fullName
              m.draftChanges = null
            }
            if (d.status === 'active') {
              d.catalogVersion = newVersion
            }
          }

          // Promote draft new diseases into active db.diseases
          for (const draft of state.draftNewDiseases) {
            db.diseases.push({
              id: draft.id,
              name: draft.name,
              pathogen: draft.pathogen,
              category: draft.category === 'Algal' ? 'Algal' : 'Fungal',
              catalogVersion: newVersion,
              status: 'active',
            })
            state.diseaseMetadata[draft.id] = {
              summary: draft.summary,
              diagnosticCriteria: draft.diagnosticCriteria,
              differentialDiagnosis: draft.differentialDiagnosis,
              treatmentGuidance: draft.treatmentGuidance,
              favorableConditions: draft.favorableConditions,
              typicalSeverity: draft.typicalSeverity,
              symptomIds: [...draft.symptomIds],
              updatedAt: timestamp,
              updatedBy: actor.fullName,
              draftChanges: null,
            }
          }
          state.draftNewDiseases = []

          // Promote draft symptoms to active
          for (const sym of state.symptoms) {
            sym.status = 'active'
          }

          // Update catalog versions history
          for (const v of state.catalogVersions) {
            if (v.status === 'Active') v.status = 'Published'
          }
          const existingDraftVersion = state.catalogVersions.find((v) => v.version === newVersion)
          if (existingDraftVersion) {
            existingDraftVersion.status = 'Active'
            existingDraftVersion.publishedAt = timestamp
            existingDraftVersion.publishedBy = actor.fullName
            existingDraftVersion.releaseNotes = input.releaseNotes
            existingDraftVersion.diseaseCount = db.diseases.filter((d) => d.status === 'active').length
            existingDraftVersion.symptomCount = state.symptoms.length
          } else {
            state.catalogVersions.unshift({
              version: newVersion,
              status: 'Active',
              publishedAt: timestamp,
              publishedBy: actor.fullName,
              diseaseCount: db.diseases.filter((d) => d.status === 'active').length,
              symptomCount: state.symptoms.length,
              releaseNotes: input.releaseNotes,
              changesSummary: [input.releaseNotes],
            })
          }

          state.activeCatalogVersion = newVersion
          state.notifications.unshift({
            id: `NTF-CAT-${newVersion}`,
            title: `Catalog v${newVersion} published as Active`,
            detail: `Published by ${actor.fullName} · Existing diagnoses remain pinned to their original catalog version`,
            at: timestamp,
            unread: true,
            category: 'Catalog',
            to: '/cases/catalog',
          })

          return buildWorkspace(db, actor, state)
        }),
      )
    },

    deactivateDisease(input, meta) {
      return store.run(() =>
        store.write((db) => {
          const actor = actorOf(db)
          const state = getOrCreateCasesState(store)
          void meta
          const disease = db.diseases.find((d) => d.id === input.diseaseId)
          if (!disease) throw new AppError('not_found', `Disease "${input.diseaseId}" was not found.`)
          disease.status = 'inactive'
          if (state.diseaseMetadata[disease.id]) {
            state.diseaseMetadata[disease.id].updatedAt = now()
            state.diseaseMetadata[disease.id].updatedBy = actor.fullName
          }
          return buildDiseaseCatalog(db, state).find((d) => d.id === disease.id)!
        }),
      )
    },

    sendAiPrompt(input) {
      return store.run(() =>
        store.write((db) => {
          const actor = actorOf(db)
          const state = getOrCreateCasesState(store)
          const timestamp = now()
          let thread = state.aiThreads.find((t) => t.id === input.threadId)
          if (!thread) {
            thread = {
              id: input.threadId || `AI-THR-${state.aiThreads.length + 1}`,
              title: input.prompt.slice(0, 48),
              updatedAt: timestamp,
              contextBadge: [input.contextCaseId, input.contextDiseaseId].filter(Boolean).join(' · ') || 'General Catalog Query',
              messages: [],
            }
            state.aiThreads.unshift(thread)
          }

          const userMsgId = `AIM-U-${Date.now()}`
          thread.messages.push({
            id: userMsgId,
            role: 'user',
            createdAt: timestamp,
            content: input.prompt,
            attachedContext: {
              caseId: input.contextCaseId,
              diseaseId: input.contextDiseaseId,
            },
            citations: [],
            isDegradedFallback: false,
          })

          const diseases = buildDiseaseCatalog(db, state)
          const cases = buildScopedCases(db, actor, state)
          const matchedCase = input.contextCaseId
            ? cases.find((c) => c.id === input.contextCaseId || c.caseId === input.contextCaseId)
            : undefined
          const matchedDisease =
            (input.contextDiseaseId ? diseases.find((d) => d.id === input.contextDiseaseId) : undefined) ??
            (matchedCase ? diseases.find((d) => d.id === matchedCase.suspectedDisease.id) : undefined) ??
            diseases.find((d) => input.prompt.toLowerCase().includes(d.name.toLowerCase())) ??
            diseases[0]

          const isDegraded = Boolean(input.simulateDegradedMode)

          const replyContent = isDegraded
            ? `[Degraded Mode · Local Catalog Rule Matcher Active]\nLive AI inference is temporarily unavailable. Deterministic match from Active Catalog v${state.activeCatalogVersion}:\n\n• Matched Entry: ${matchedDisease.name} (${matchedDisease.id} · ${matchedDisease.pathogen})\n• Diagnostic Criteria: ${matchedDisease.diagnosticCriteria}\n• Differential Diagnosis: ${matchedDisease.differentialDiagnosis}\n• Recommended Action: ${matchedDisease.treatmentGuidance}\n\nNote: Advisory only. Confirm symptoms manually in the Record Diagnosis form.`
            : `Advisory Clinical Synthesis${matchedCase ? ` for ${matchedCase.id} (${matchedCase.observationId} · ${matchedCase.division.name})` : ''}:\n\n1. Catalog Reference (${matchedDisease.id} · v${matchedDisease.catalogVersion}): ${matchedDisease.diagnosticCriteria}\n2. Differential Check: ${matchedDisease.differentialDiagnosis}\n3. Containment & Treatment Guidance: ${matchedDisease.treatmentGuidance}\n\nReminder: This response is advisory only and never writes an official diagnosis.`

          thread.messages.push({
            id: `AIM-A-${Date.now() + 1}`,
            role: 'assistant',
            createdAt: timestamp,
            content: replyContent,
            attachedContext: {
              caseId: matchedCase?.id ?? input.contextCaseId,
              observationId: matchedCase?.observationId,
              diseaseId: matchedDisease.id,
            },
            citations: [
              {
                code: `${matchedDisease.id} · v${matchedDisease.catalogVersion}`,
                title: `${matchedDisease.name} (${matchedDisease.pathogen})`,
                version: `Catalog v${matchedDisease.catalogVersion} (${matchedDisease.status === 'active' ? 'Active' : 'Draft'})`,
                excerpt: matchedDisease.diagnosticCriteria,
              },
            ],
            isDegradedFallback: isDegraded,
          })

          thread.updatedAt = timestamp
          return structuredClone(thread)
        }),
      )
    },

    markAllNotificationsRead() {
      return store.run(() =>
        store.write((db) => {
          const actor = actorOf(db)
          const state = getOrCreateCasesState(store)
          for (const item of state.notifications) {
            item.unread = false
          }
          return buildWorkspace(db, actor, state)
        }),
      )
    },

    exportList() {
      return store.run(() =>
        store.read((db) => {
          actorOf(db)
          return { simulated: true }
        }),
      )
    },
  }
}
