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
    webApp?: {
      runner?: string
    }
  }
}

function AppRouter() {
  // const { settings, runnerError } = useSettings()

  // useEffect(() => {
  //   if (!runnerError) {
  //     return
  //   }

  //   const currentPath = window.location.pathname
  //   if (
  //     currentPath === '/settings' ||
  //     currentPath === '/login' ||
  //     currentPath === '/oidc/login'
  //   ) {
  //     return
  //   }

  //   const runnerErrorStr = runnerError?.toString() || ''
  //   const isError401 = runnerErrorStr.includes('401')
  //   const loginUrl = settings.requireAuth ? '/oidc/login' : '/login'
  //   const redirectUrl = isError401 ? loginUrl : '/settings'

  //   window.location.href = redirectUrl
  // }, [runnerError, settings.requireAuth])

  return (
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
            <Layout left={<Chat />} middle={<Actions />} right={<Settings />} />
          }
        />
        <Route
          path="/oidc/*"
          element={
            <Layout
              middle={
                <div>OIDC routes are exclusively handled by the server.</div>
              }
            />
          }
        />
        <Route path="/login" element={<Layout left={<Login />} />} />
        <Route path="*" element={<Layout left={<NotFound />} />} />
      </Routes>
    </BrowserRouter>
  )
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
        <SettingsProvider
          requireAuth={initialState?.requireAuth}
          webApp={initialState?.webApp}
        >
          <AgentClientProvider>
            <BlockProvider>
              <AppRouter />
            </BlockProvider>
          </AgentClientProvider>
        </SettingsProvider>
      </Theme>
    </>
  )
}

export default App
