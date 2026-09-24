// ErrorBoundary — fängt Render-Crashes ab und zeigt die Meldung statt
// eines weißen Screens („gesamter Screen weiß nach Kalibrierung").
import { Component, type ReactNode } from 'react';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#0a0e18', color: '#ff9d9d',
          display: 'grid', placeItems: 'center', fontFamily: 'monospace', padding: 32, zIndex: 9999 }}>
          <div style={{ maxWidth: 720 }}>
            <h2 style={{ marginBottom: 12 }}>Unerwarteter Fehler</h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: .9 }}>
              {String(this.state.error?.stack || this.state.error)}
            </pre>
            <button onClick={() => location.reload()}
              style={{ marginTop: 18, padding: '10px 22px', background: '#1d3a5f', color: '#cfe6ff',
                border: '1px solid #3a6ea5', borderRadius: 10, cursor: 'pointer' }}>
              Neu laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
