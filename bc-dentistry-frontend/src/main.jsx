import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter as Router } from 'react-router-dom'
import { RoleProvider } from './assets/Context/RoleContext.jsx';
import { installSessionInterceptors } from './assets/config/api.js';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';

installSessionInterceptors();
const cspNonce = document.querySelector('meta[name="csp-nonce"]')?.content;
const emotionCache = createCache({ key: 'edr', nonce: cspNonce });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CacheProvider value={emotionCache}>
      <RoleProvider>
        <Router>
          <App />
        </Router>
      </RoleProvider>
    </CacheProvider>
  </React.StrictMode>,
)
