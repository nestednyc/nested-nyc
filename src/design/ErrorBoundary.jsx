import React from 'react'

/**
 * Top-level error boundary. Catches render/runtime errors anywhere in the tree
 * and shows a calm recovery screen instead of a blank white page. Styles are
 * self-contained (literal colors, not CSS vars) so the fallback renders even if
 * something in the app's styling pipeline is what failed.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface to the console for now; a real error monitor (e.g. Sentry) can
    // hook in here later without touching the rest of the tree.
    console.error('Unhandled UI error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
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
          <div style={{ fontSize: 40, marginBottom: 12 }}>📌</div>
          <h1
            style={{
              fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
              fontSize: 24,
              margin: '0 0 8px',
            }}
          >
            Something came loose
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: 'oklch(0.47 0.02 60)', margin: '0 0 20px' }}>
            The board hit an unexpected error. A refresh usually pins it back up.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '10px 22px',
              cursor: 'pointer',
              background: 'oklch(0.60 0.185 30)',
              color: 'oklch(0.985 0.005 95)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
