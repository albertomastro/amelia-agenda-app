import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Crea dati mock per development
window.ameliaCalendarData = {
  restUrl: '/wp-json/amelia-calendar/v1',
  nonce: 'mock-nonce-dev',
  providerId: 1
}

const rootElement = document.getElementById('amelia-provider-calendar-root')

if (rootElement) {
  console.log('✅ Root element found!')
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} else {
  console.error('❌ Root element not found!')
  console.log('Available elements:', document.body.innerHTML)
}
