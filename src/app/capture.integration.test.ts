import { expect, it } from 'vitest'
import { FIXTURE_DEV_PASSWORD } from '@/fixtures'
import { createContainer } from './composition/container'

it('wires Capture to the existing Identity sign-in, estate scope and sign-out', async () => {
  const container = await createContainer({ dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15_000 })
  await expect(container.capture.getObservation('OBS-005')).rejects.toMatchObject({ kind: 'unauthorized' })
  const session = await container.auth.signIn({ identifier: 'malini.fernando', password: FIXTURE_DEV_PASSWORD, remember: false })
  await expect(container.capture.getObservation('OBS-005')).resolves.toMatchObject({ estate: { id: 'EST-002' } })
  await expect(container.capture.getObservation('OBS-001')).rejects.toMatchObject({ kind: 'not_found' })
  await container.auth.signOut(session)
  await expect(container.capture.getObservation('OBS-005')).rejects.toMatchObject({ kind: 'unauthorized' })
})

it('wires API-mode Capture to contract-pending instead of fixtures', async () => {
  const container = await createContainer({ dataSource: 'api', apiBaseUrl: 'http://localhost:3000/api/v1', apiTimeoutMs: 15_000 })
  await expect(container.capture.getObservation('OBS-005')).rejects.toMatchObject({ kind: 'contract_pending' })
  expect(container.fixtures).toBeNull()
})
