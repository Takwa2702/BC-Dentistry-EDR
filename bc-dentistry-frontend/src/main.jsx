import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter as Router } from 'react-router-dom'
import { RoleProvider } from './assets/Context/RoleContext.jsx';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RoleProvider>
      <Router>
        <App />
      </Router>
    </RoleProvider>
  </React.StrictMode>,
) 