import { Helmet } from 'react-helmet'
import { BrowserRouter, Route, Routes } from 'react-router'

import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'

import openaiLogo from './assets/openai.svg'
import Actions from './components/Actions'
import Chat from './components/Chat/Chat'
import FileViewer from './components/Files/Viewer'
import { AgentClientProvider } from './contexts/AgentContext'
import { BlockProvider } from './contexts/BlockContext'
import Layout from './layout'

function App() {
  return (
    <>
      <Theme accentColor="gray" scaling="110%" radius="small">
        <Helmet>
          <title>Cloud Assistant</title>
          <meta name="description" content="An AI Assistant For Your Cloud" />
          <link rel="icon" href={openaiLogo} />
        </Helmet>
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
              </Routes>
            </BrowserRouter>
          </BlockProvider>
        </AgentClientProvider>
      </Theme>
    </>
  )
}

export default App
