import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AuthUseCases } from '../../application/authUseCases'
import { SessionContext, type SessionContextValue, type SessionState } from './sessionContext'

export interface SessionProviderProps {
  auth: AuthUseCases
  /** Called whenever the session ends (sign-out or expiry), e.g. to clear cached server data. */
  onSessionEnded?: () => void
  children: ReactNode
}

export function SessionProvider({ auth, onSessionEnded, children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>(() => {
    const restored = auth.restore()
    return restored ? { status: 'signed_in', session: restored } : { status: 'signed_out' }
  })
  const stateRef = useRef(state)
  const publish = useCallback((next: SessionState) => {
    stateRef.current = next
    setState(next)
  }, [])

  useEffect(() => {
    if (!auth.subscribeSession) return
    const reconcile = () => {
      const previous = stateRef.current
      if (previous.status !== 'signed_in') return
      const current = auth.restore()
      if (current && JSON.stringify(current) === JSON.stringify(previous.session)) return
      const before = previous.session.user
      const accessChanged = !current || before.role !== current.user.role
        || JSON.stringify([...before.estateIds].sort()) !== JSON.stringify([...current.user.estateIds].sort())
        || JSON.stringify([...before.divisionIds].sort()) !== JSON.stringify([...current.user.divisionIds].sort())
      // Publish the new authorization state before callers can navigate after a write.
      const next: SessionState = current ? { status: 'signed_in', session: current } : { status: 'signed_out' }
      publish(next)
      // Every cached resource belongs to the old authorization context. Do not retain
      // Capture/Review data under a new role or scope. Ordinary name edits keep caches.
      if (accessChanged) onSessionEnded?.()
    }
    const unsubscribe = auth.subscribeSession(reconcile)
    reconcile()
    return unsubscribe
  }, [auth, onSessionEnded, publish])

  const signIn = useCallback<SessionContextValue['signIn']>(
    async (credentials, options, signal) => {
      const result = await auth.signIn(credentials, options, signal)
      if (result.status === 'signed_in') publish({ status: 'signed_in', session: result.session })
      return result
    },
    [auth, publish],
  )

  const verifyMfa = useCallback<SessionContextValue['verifyMfa']>(
    async (challenge, code, signal) => {
      const session = await auth.verifyMfa(challenge, code, signal)
      publish({ status: 'signed_in', session })
      return session
    },
    [auth, publish],
  )

  const rememberedUserId = useCallback(() => auth.rememberedUserId(), [auth])

  const startMfaEnrollment = useCallback<SessionContextValue['startMfaEnrollment']>(
    (enrollment, signal) => auth.startMfaEnrollment(enrollment, signal),
    [auth],
  )

  const confirmMfaEnrollment = useCallback<SessionContextValue['confirmMfaEnrollment']>(
    async (enrollment, code, signal) => {
      const result = await auth.confirmMfaEnrollment(enrollment, code, signal)
      if (result.session) publish({ status: 'signed_in', session: result.session })
      return result
    },
    [auth, publish],
  )

  const discard = useCallback(() => {
    auth.discard()
    publish({ status: 'signed_out' })
    onSessionEnded?.()
  }, [auth, onSessionEnded, publish])

  const signOut = useCallback(async () => {
    const previous = stateRef.current
    const current = previous.status === 'signed_in' ? previous.session : null
    publish({ status: 'signed_out' })
    onSessionEnded?.()
    if (current) {
      try {
        await auth.signOut(current)
      } catch {
        // The local session is already cleared; a failed server-side sign-out is not
        // something the user can act on.
      }
    } else {
      auth.discard()
    }
  }, [auth, onSessionEnded, publish])

  const expire = useCallback(() => {
    auth.discard()
    const previous = stateRef.current
    publish(previous.status === 'signed_in' ? { status: 'expired' } : previous)
    onSessionEnded?.()
  }, [auth, onSessionEnded, publish])

  const updateUser = useCallback<SessionContextValue['updateUser']>(
    (patch) => {
      const previous = stateRef.current
      if (previous.status !== 'signed_in') return
      const session = { ...previous.session, user: { ...previous.session.user, ...patch } }
      auth.replace(session)
      publish({ status: 'signed_in', session })
    },
    [auth, publish],
  )

  const value = useMemo<SessionContextValue>(
    () => ({ state, signIn, verifyMfa, startMfaEnrollment, confirmMfaEnrollment, discard, rememberedUserId, signOut, expire, updateUser }),
    [state, signIn, verifyMfa, startMfaEnrollment, confirmMfaEnrollment, discard, rememberedUserId, signOut, expire, updateUser],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
