import { useCallback, useMemo, useState, type ReactNode } from 'react'
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

  const signIn = useCallback<SessionContextValue['signIn']>(
    async (credentials, options, signal) => {
      const result = await auth.signIn(credentials, options, signal)
      if (result.status === 'signed_in') setState({ status: 'signed_in', session: result.session })
      return result
    },
    [auth],
  )

  const verifyMfa = useCallback<SessionContextValue['verifyMfa']>(
    async (challenge, code, signal) => {
      const session = await auth.verifyMfa(challenge, code, signal)
      setState({ status: 'signed_in', session })
      return session
    },
    [auth],
  )

  const rememberedUserId = useCallback(() => auth.rememberedUserId(), [auth])

  const startMfaEnrollment = useCallback<SessionContextValue['startMfaEnrollment']>(
    (enrollment, signal) => auth.startMfaEnrollment(enrollment, signal),
    [auth],
  )

  const confirmMfaEnrollment = useCallback<SessionContextValue['confirmMfaEnrollment']>(
    async (enrollment, code, signal) => {
      const result = await auth.confirmMfaEnrollment(enrollment, code, signal)
      if (result.session) setState({ status: 'signed_in', session: result.session })
      return result
    },
    [auth],
  )

  const discard = useCallback(() => {
    auth.discard()
    setState({ status: 'signed_out' })
    onSessionEnded?.()
  }, [auth, onSessionEnded])

  const signOut = useCallback(async () => {
    const current = state.status === 'signed_in' ? state.session : null
    setState({ status: 'signed_out' })
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
  }, [auth, onSessionEnded, state])

  const expire = useCallback(() => {
    auth.discard()
    setState((previous) => (previous.status === 'signed_in' ? { status: 'expired' } : previous))
    onSessionEnded?.()
  }, [auth, onSessionEnded])

  const updateUser = useCallback<SessionContextValue['updateUser']>(
    (patch) => {
      if (state.status !== 'signed_in') return
      const session = { ...state.session, user: { ...state.session.user, ...patch } }
      auth.replace(session)
      setState({ status: 'signed_in', session })
    },
    [auth, state],
  )

  const value = useMemo<SessionContextValue>(
    () => ({ state, signIn, verifyMfa, startMfaEnrollment, confirmMfaEnrollment, discard, rememberedUserId, signOut, expire, updateUser }),
    [state, signIn, verifyMfa, startMfaEnrollment, confirmMfaEnrollment, discard, rememberedUserId, signOut, expire, updateUser],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
