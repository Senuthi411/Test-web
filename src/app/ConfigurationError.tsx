/**
 * Shown when the environment configuration is invalid. Rendered without the router or
 * providers, so it uses plain markup with the design tokens.
 */
export function ConfigurationError({ problems }: { problems: string[] }) {
  return (
    <main style={{ maxWidth: 640, margin: '64px auto', padding: '0 16px' }}>
      <div
        role="alert"
        style={{
          padding: 28,
          borderRadius: 'var(--tl-radius-card-lg)',
          background: 'var(--tl-bg-surface)',
          boxShadow: 'var(--tl-shadow-card)',
        }}
      >
        <h1 style={{ font: 'var(--tl-font-modal-title)', marginBottom: 12 }}>Configuration error</h1>
        <p style={{ color: 'var(--tl-text-muted)', marginBottom: 12 }}>
          The application cannot start because its environment configuration is invalid:
        </p>
        <ul>
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
        <p style={{ color: 'var(--tl-text-muted)', marginTop: 12 }}>
          See <code>.env.example</code> for the supported variables.
        </p>
      </div>
    </main>
  )
}
