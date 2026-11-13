/**
 * Estates, divisions, users and the disease catalog.
 * Source: ID-03 User Management (15:2), ID-04 per-user variants (205:140 … 205:3187),
 * ID-09 Estate Management (16:596), ID-11 Division Management (17:2),
 * ID-14 My Profile (17:934), CASE-07 Disease Catalog (23:162).
 */
import type { FixtureDisease, FixtureDivision, FixtureEstate, FixtureNotificationPreferences, FixtureUser } from '../records'

export const estates: FixtureEstate[] = [
  { id: 'EST-001', name: 'Highland Tea Estate', region: 'Nuwara Eliya', status: 'active', createdAt: null },
  { id: 'EST-002', name: 'Riverbend Tea Estate', region: 'Kandy', status: 'active', createdAt: null },
  { id: 'EST-003', name: 'Mist Valley Tea Estate', region: 'Badulla', status: 'active', createdAt: null },
]

export const divisions: FixtureDivision[] = [
  { id: 'DIV-001', name: 'North Ridge', estateId: 'EST-001', status: 'active' },
  { id: 'DIV-002', name: 'Central Terrace', estateId: 'EST-001', status: 'active' },
  { id: 'DIV-003', name: 'Lower Slope', estateId: 'EST-001', status: 'active' },
  { id: 'DIV-004', name: 'Riverbank', estateId: 'EST-002', status: 'active' },
  { id: 'DIV-005', name: 'East Hills', estateId: 'EST-002', status: 'active' },
  { id: 'DIV-006', name: 'West Terrace', estateId: 'EST-002', status: 'active' },
  { id: 'DIV-007', name: 'Upper Mist', estateId: 'EST-003', status: 'active' },
  { id: 'DIV-008', name: 'South Valley', estateId: 'EST-003', status: 'active' },
  { id: 'DIV-009', name: 'Forest Edge', estateId: 'EST-003', status: 'active' },
]

/** ID-14 shows Review escalations and Device session alerts on, Weekly summary off. */
const DEFAULT_PREFERENCES: FixtureNotificationPreferences = {
  reviewEscalations: true,
  deviceSessionAlerts: true,
  weeklySummary: false,
}

type UserSeed = Pick<FixtureUser, 'id' | 'fullName' | 'email' | 'role' | 'estateIds' | 'divisionIds'> &
  Partial<Pick<FixtureUser, 'createdAt' | 'lastSignInAt' | 'scopeAssignedAt'>>

function user(seed: UserSeed): FixtureUser {
  return {
    status: 'active',
    createdAt: null,
    lastSignInAt: null,
    scopeAssignedAt: null,
    version: 1,
    language: 'en',
    notificationPreferences: { ...DEFAULT_PREFERENCES },
    ...seed,
  }
}

export const users: FixtureUser[] = [
  // ID-14 "Last sign-in: Today · 07:41" (ID-04 shows "—" for the same user; see figma-inconsistencies).
  user({ id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [], lastSignInAt: '2026-10-21T07:41:00+05:30' }),
  user({ id: 'USR-002', fullName: 'Nimal Silva', email: 'nimal.silva@example.test', role: 'SUPERVISOR', estateIds: ['EST-001'], divisionIds: [] }),
  user({ id: 'USR-003', fullName: 'Malini Fernando', email: 'malini.fernando@example.test', role: 'SUPERVISOR', estateIds: ['EST-002'], divisionIds: [] }),
  user({ id: 'USR-004', fullName: 'Kavishka Jay', email: 'kavishka.jay@example.test', role: 'SUPERVISOR', estateIds: ['EST-003'], divisionIds: [], lastSignInAt: '2026-10-20' }),
  user({ id: 'USR-005', fullName: 'Dr Tara Wijesinghe', email: 'dr.tara.wijesinghe@example.test', role: 'DISEASE_EXPERT', estateIds: ['EST-001', 'EST-002'], divisionIds: [] }),
  user({ id: 'USR-006', fullName: 'Dr Sahan Amarasinghe', email: 'dr.sahan.amarasinghe@example.test', role: 'DISEASE_EXPERT', estateIds: ['EST-003'], divisionIds: [], lastSignInAt: '2026-10-21T07:48:00+05:30' }),
  user({ id: 'USR-007', fullName: 'Ishara Kumari', email: 'ishara.kumari@example.test', role: 'FIELD_WORKER', estateIds: [], divisionIds: ['DIV-001', 'DIV-002'] }),
  user({ id: 'USR-008', fullName: 'Dinuka Sen', email: 'dinuka.sen@example.test', role: 'FIELD_WORKER', estateIds: [], divisionIds: ['DIV-003'] }),
  user({ id: 'USR-009', fullName: 'Hiruni Nadeesha', email: 'hiruni.nadeesha@example.test', role: 'FIELD_WORKER', estateIds: [], divisionIds: ['DIV-004', 'DIV-005'], createdAt: '2026-09-14', scopeAssignedAt: '2026-09-14' }),
  user({ id: 'USR-010', fullName: 'Ravindu Kumara', email: 'ravindu.kumara@example.test', role: 'FIELD_WORKER', estateIds: [], divisionIds: ['DIV-006'] }),
  user({ id: 'USR-011', fullName: 'Sewmi Raj', email: 'sewmi.raj@example.test', role: 'FIELD_WORKER', estateIds: [], divisionIds: ['DIV-007', 'DIV-008'] }),
  user({ id: 'USR-012', fullName: 'Pasan Fernando', email: 'pasan.fernando@example.test', role: 'FIELD_WORKER', estateIds: [], divisionIds: ['DIV-009'] }),
  user({ id: 'USR-013', fullName: 'Maya Dissanayake', email: 'maya.dissanayake@example.test', role: 'REPORTING_USER', estateIds: ['EST-001', 'EST-002'], divisionIds: [] }),
]

export const diseases: FixtureDisease[] = [
  { id: 'DIS-001', name: 'Blister blight', pathogen: 'Exobasidium vexans', category: 'Fungal', catalogVersion: 2, status: 'active' },
  { id: 'DIS-002', name: 'Grey blight', pathogen: 'Pestalotiopsis theae', category: 'Fungal', catalogVersion: 2, status: 'active' },
  { id: 'DIS-003', name: 'Brown blight', pathogen: 'Colletotrichum species', category: 'Fungal', catalogVersion: 2, status: 'active' },
  { id: 'DIS-004', name: 'Algal leaf spot', pathogen: 'Cephaleuros virescens', category: 'Algal', catalogVersion: 2, status: 'active' },
]
