import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#666' }}>{this.state.error?.message}</p>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: 16, padding: '10px 24px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Clear Data &amp; Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
