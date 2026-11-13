import type { DivisionId, EstateId, UserRole } from '@/shared/types'

/**
 * Scope levels as stated in the designs:
 * - ID-08 banner: "Field workers are assigned at division level; experts and supervisors at
 *   estate level."
 * - ID-11: "division is the finest scope unit".
 * - ID-04 (USR-001): administrators hold "All estates".
 * Reporting users are estate-scoped on ID-03/ID-04 ("EST-001, EST-002").
 *
 * The backend enforces scope on every request; these rules only shape the forms.
 */
export type ScopeLevel = 'all_estates' | 'estate' | 'division'

export function scopeLevelFor(role: UserRole): ScopeLevel {
  if (role === 'ADMINISTRATOR') return 'all_estates'
  if (role === 'FIELD_WORKER') return 'division'
  return 'estate'
}

export interface ScopeSelection {
  estateIds: EstateId[]
  divisionIds: DivisionId[]
}

export interface ScopeTopology {
  estates: ReadonlyArray<{ id: EstateId; name: string }>
  divisions: ReadonlyArray<{ id: DivisionId; name: string; estateId: EstateId }>
}

/** "Mist Valley Tea Estate" → "Mist Valley" (ID-02, ID-04, ID-09 short labels). */
export function shortEstateName(name: string): string {
  return name.replace(/\s+Tea Estate$/i, '')
}

const byId = (a: string, b: string) => a.localeCompare(b)

/** Keeps only the identifiers that belong to the role's scope level, sorted. */
export function normaliseScope(level: ScopeLevel, selection: ScopeSelection, topology: ScopeTopology): ScopeSelection {
  if (level === 'all_estates') return { estateIds: topology.estates.map((estate) => estate.id).sort(byId), divisionIds: [] }
  if (level === 'estate') return { estateIds: [...new Set(selection.estateIds)].sort(byId), divisionIds: [] }
  return { estateIds: [], divisionIds: [...new Set(selection.divisionIds)].sort(byId) }
}

export function coveredDivisionIds(level: ScopeLevel, selection: ScopeSelection, topology: ScopeTopology): DivisionId[] {
  if (level === 'division') return [...selection.divisionIds]
  const estates = level === 'all_estates' ? new Set(topology.estates.map((e) => e.id)) : new Set(selection.estateIds)
  return topology.divisions.filter((division) => estates.has(division.estateId)).map((division) => division.id)
}

export function coveredEstateIds(level: ScopeLevel, selection: ScopeSelection, topology: ScopeTopology): EstateId[] {
  if (level === 'all_estates') return topology.estates.map((estate) => estate.id)
  if (level === 'estate') return [...selection.estateIds]
  const estateOf = new Map(topology.divisions.map((division) => [division.id, division.estateId]))
  return [...new Set(selection.divisionIds.map((id) => estateOf.get(id)).filter((id): id is EstateId => Boolean(id)))]
}

export interface EffectiveScope {
  estates: { covered: number; total: number }
  divisions: { covered: number; total: number }
  unassignedEstates: Array<{ id: EstateId; name: string }>
}

/** ID-08 "Effective scope" card: "2 of 3", "6 of 9", "Mist Valley (EST-003)". */
export function effectiveScope(level: ScopeLevel, selection: ScopeSelection, topology: ScopeTopology): EffectiveScope {
  const estates = new Set(coveredEstateIds(level, selection, topology))
  return {
    estates: { covered: estates.size, total: topology.estates.length },
    divisions: { covered: coveredDivisionIds(level, selection, topology).length, total: topology.divisions.length },
    unassignedEstates: topology.estates.filter((estate) => !estates.has(estate.id)),
  }
}

export function validateScope(level: ScopeLevel, selection: ScopeSelection): string | null {
  if (level === 'estate' && selection.estateIds.length === 0) return 'Select at least one estate.'
  if (level === 'division' && selection.divisionIds.length === 0) return 'Select at least one division.'
  return null
}

export function sameScope(a: ScopeSelection, b: ScopeSelection): boolean {
  const key = (s: ScopeSelection) => `${[...s.estateIds].sort(byId).join(',')}|${[...s.divisionIds].sort(byId).join(',')}`
  return key(a) === key(b)
}

/**
 * Plain-language summary of a scope change for the ID-08 confirmation, e.g.
 * "Add EST-003 Mist Valley to estate-level scope".
 */
export function describeScopeChange(level: ScopeLevel, before: ScopeSelection, after: ScopeSelection, topology: ScopeTopology): string {
  const isEstate = level !== 'division'
  const beforeIds = new Set(isEstate ? before.estateIds : before.divisionIds)
  const afterIds = new Set(isEstate ? after.estateIds : after.divisionIds)
  const label = (id: string) => {
    const name = isEstate
      ? shortEstateName(topology.estates.find((estate) => estate.id === id)?.name ?? '')
      : (topology.divisions.find((division) => division.id === id)?.name ?? '')
    return name ? `${id} ${name}` : id
  }
  const added = [...afterIds].filter((id) => !beforeIds.has(id)).sort(byId).map(label)
  const removed = [...beforeIds].filter((id) => !afterIds.has(id)).sort(byId).map(label)
  const levelLabel = isEstate ? 'estate-level scope' : 'division-level scope'
  const parts: string[] = []
  if (added.length) parts.push(`Add ${added.join(', ')} to ${levelLabel}`)
  if (removed.length) parts.push(`${parts.length ? 'remove' : 'Remove'} ${removed.join(', ')} from ${levelLabel}`)
  return parts.length ? parts.join('; ') : 'No change'
}

/** Identifiers shown in "Scope" columns: estates for estate-level users, divisions for field workers. */
export function scopeIdsOf(user: ScopeSelection): string[] {
  return user.estateIds.length > 0 ? user.estateIds : user.divisionIds
}
