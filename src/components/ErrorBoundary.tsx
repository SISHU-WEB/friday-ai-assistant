import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render errors in the post-login app so a crash on the phone shows
 * visible text instead of a solid black screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Friday render error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'grid',
            placeItems: 'center',
            background: '#0b0f0d',
            color: '#edf5f0',
            fontFamily: 'system-ui, sans-serif',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div>
            <h2 style={{ marginBottom: 12 }}>出了点问题 / Something went wrong</h2>
            <p style={{ color: '#929d97', maxWidth: 320, wordBreak: 'break-word' }}>
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 20,
                padding: '10px 20px',
                borderRadius: 999,
                border: 'none',
                background: '#42db7a',
                color: '#06120a',
                fontWeight: 600,
              }}
            >
              重新加载 / Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
