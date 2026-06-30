import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './design/styles.css'

// Load migration utilities (exposes window.migrateToSupabase and window.checkLocalData)
import './utils/migrateLocalStorage'

// Publish the on-screen keyboard height as the CSS var --kb so bottom-pinned UI
// (onboarding sticky CTA, DM composer) stays above the keyboard on iOS Safari.
import './utils/keyboardInset'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
