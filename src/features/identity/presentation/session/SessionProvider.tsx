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
    async (credentials, signal) => {
      const session = await auth.signIn(credentials, signal)
      setState({ status: 'signed_in', session })
      return session
    },
    [auth],
  )

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
    () => ({ state, signIn, signOut, expire, updateUser }),
    [state, signIn, signOut, expire, updateUser],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
