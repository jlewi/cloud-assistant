import { createRoot } from 'react-dom/client'

import App, { AppProps } from './App.tsx'
import logo from './assets/openai.svg'
import './index.css'

// Define the type for the window object with initial state
declare global {
  interface Window {
    __INITIAL_STATE__?: AppProps['initialState']
  }
}

// Read initial state from window object
const initialState = window.__INITIAL_STATE__ || {}

createRoot(document.getElementById('root')!).render(
  <App initialState={initialState} logo={logo} />
)
