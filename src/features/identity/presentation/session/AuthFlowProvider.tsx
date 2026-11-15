import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AuthFlowContext, EMPTY_AUTH_FLOW, type AuthFlowContextValue, type AuthFlowState } from './authFlowContext'

/** Keeps in-progress MFA, enrollment and recovery references in memory only. */
export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthFlowState>(EMPTY_AUTH_FLOW)
  const update = useCallback((patch: Partial<AuthFlowState>) => setState((previous) => ({ ...previous, ...patch })), [])
  const clear = useCallback(() => setState(EMPTY_AUTH_FLOW), [])
  const value = useMemo<AuthFlowContextValue>(() => ({ ...state, update, clear }), [state, update, clear])
  return <AuthFlowContext.Provider value={value}>{children}</AuthFlowContext.Provider>
}
