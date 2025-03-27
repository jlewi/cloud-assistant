import Layout from './layout'
import { Helmet } from 'react-helmet'
import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'

import Actions from './components/Actions'
import Chat from './components/Chat/Chat'
import FileViewer from './components/Placeholder'

import openaiLogo from './assets/openai.svg'
import { AgentClientProvider } from './contexts/AgentContext'

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
          <Layout left={<Chat />} middle={<Actions />} right={<FileViewer />} />
        </AgentClientProvider>
      </Theme>
    </>
  )
}

export default App
