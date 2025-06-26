import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Code } from '@buf/googleapis_googleapis.bufbuild_es/google/rpc/code_pb'
import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import {
  Actions,
  AgentClientProvider,
  AppProps,
  BlockProvider,
  Chat,
  FilesViewer,
  Layout,
  Login,
  NotFound,
  Settings,
  SettingsProvider,
  useSettings,
} from '@runmedev/react-components'
import '@runmedev/react-components/react-components.css'

function AppRouter({ branding }: AppProps) {
  const { settings, runnerError } = useSettings()

  useEffect(() => {
    if (!runnerError) {
      return
    }

    const settingsPath = '/settings'
    const currentPath = window.location.pathname
    if (
      currentPath === settingsPath ||
      currentPath === '/login' ||
      currentPath === '/oidc/login'
    ) {
      return
    }

    const loginUrl = settings.requireAuth ? '/oidc/login' : '/login'

    if (!(runnerError instanceof Error) && !(runnerError instanceof Event)) {
      const isAuthError =
        runnerError.code === Code.UNAUTHENTICATED ||
        runnerError.code === Code.PERMISSION_DENIED
      const redirectUrl = isAuthError ? loginUrl : settingsPath
      window.location.href = redirectUrl
      return
    }

    window.location.href = settingsPath
  }, [runnerError, settings.requireAuth])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              branding={branding}
              left={<Chat />}
              middle={<Actions />}
              right={<FilesViewer />}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <Layout
              branding={branding}
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
              branding={branding}
              middle={
                <div>OIDC routes are exclusively handled by the server.</div>
              }
            />
          }
        />
        <Route
          path="/login"
          element={<Layout branding={branding} left={<Login />} />}
        />
        <Route
          path="*"
          element={<Layout branding={branding} left={<NotFound />} />}
        />
      </Routes>
    </BrowserRouter>
  )
}

function App({ branding, initialState = {} }: AppProps) {
  return (
    <>
      <title>Cloud Assistant</title>
      <meta name="description" content="An AI Assistant For Your Cloud" />
      <link rel="icon" href={branding.logo} />
      <Theme accentColor="gray" scaling="100%" radius="small">
        <SettingsProvider
          requireAuth={initialState?.requireAuth}
          webApp={initialState?.webApp}
        >
          <AgentClientProvider>
            <BlockProvider>
              <AppRouter branding={branding} />
            </BlockProvider>
          </AgentClientProvider>
        </SettingsProvider>
      </Theme>
    </>
  )
}

export default App
