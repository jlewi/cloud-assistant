import { Helmet } from 'react-helmet'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'

import openaiLogo from './assets/openai.svg'
import Actions from './components/Actions/Actions'
import Chat from './components/Chat/Chat'
import FileViewer from './components/Files/Viewer'
import Login from './components/Login/Login'
import NotFound from './components/NotFound'
import Settings from './components/Settings/Settings'
import { AgentClientProvider } from './contexts/AgentContext'
import { BlockProvider } from './contexts/BlockContext'
import { SettingsProvider } from './contexts/SettingsContext'
import Layout from './layout'

export interface AppProps {
  initialState?: {
    requireAuth?: boolean
  }
}

function App({ initialState = {} }: AppProps) {
  return (
    <>
      <Theme accentColor="gray" scaling="110%" radius="small">
        <Helmet>
          <title>Cloud Assistant</title>
          <meta name="description" content="An AI Assistant For Your Cloud" />
          <link rel="icon" href={openaiLogo} />
        </Helmet>
        <SettingsProvider requireAuth={initialState.requireAuth}>
          <AgentClientProvider>
            <BlockProvider>
              <BrowserRouter>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <Layout
                        left={<Chat />}
                        middle={<Actions />}
                        right={<FileViewer />}
                      />
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <Layout
                        left={<Chat />}
                        middle={<Actions />}
                        right={<Settings />}
                      />
                    }
                  />
                  <Route
                    path="/oidc/*"
                    element={
                      <Layout
                        middle={
                          <div>
                            OIDC routes are exclusively handled by the server.
                          </div>
                        }
                      />
                    }
                  />
                  <Route path="/login" element={<Layout left={<Login />} />} />
                  <Route path="*" element={<Layout left={<NotFound />} />} />
                </Routes>
              </BrowserRouter>
            </BlockProvider>
          </AgentClientProvider>
        </SettingsProvider>
      </Theme>
    </>
  )
}

export default App
