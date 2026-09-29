import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

const App = lazy(() => import('./App'))
const SongListening = lazy(() => import('./SongListening'))
const listenRoute = window.location.pathname === '/listen' || window.location.pathname.startsWith('/listen/')
const listenToken = /^\/listen\/([^/]+)\/?$/.exec(window.location.pathname)?.[1] || ''

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading-page">Carregant…</div>}>
      {listenRoute ? <SongListening token={listenToken} /> : <App />}
    </Suspense>
  </React.StrictMode>,
)

if (!listenRoute) registerSW({ immediate: true })
