/**
 * Where the application reads its data from.
 * - `fixtures`: synthetic development records held in memory. Never live data.
 * - `api`: the NestJS API Gateway.
 */
export type DataSource = 'fixtures' | 'api'
