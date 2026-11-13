/**
 * Identifier aliases shared across features. Features reference each other's
 * records by identifier only, never by importing another feature's entities.
 *
 * The values are display identifiers as used in the approved designs
 * (e.g. "USR-001", "EST-002", "OBS-014"). The backend's final identifier format
 * (the monorepo's shared-types hint at UUIDs) is not yet confirmed.
 */
export type UserId = string
export type EstateId = string
export type DivisionId = string
export type ObservationId = string
export type DiseaseId = string
export type CaseId = string
export type ReferralId = string
