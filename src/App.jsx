import NestedApp from './design/NestedApp'
import ErrorBoundary from './design/ErrorBoundary'
import { isSupabaseConfigured, getConfigurationError } from './lib/supabase'

function App() {
  // Fail loud if a production build shipped without Supabase env vars, rather
  // than rendering an app that looks online but silently can't load any data.
  if (import.meta.env.PROD && !isSupabaseConfigured()) {
    console.error('FATAL: Supabase is not configured.', getConfigurationError())
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'oklch(0.962 0.014 83)',
          color: 'oklch(0.26 0.018 60)',
          fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1
            style={{
              fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
              fontSize: 24,
              margin: '0 0 8px',
            }}
          >
            Nested is temporarily unavailable
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: 'oklch(0.47 0.02 60)', margin: 0 }}>
            We're working on it — please check back shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <NestedApp />
    </ErrorBoundary>
  )
}

export default App
