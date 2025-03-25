import { Helmet } from 'react-helmet'
// import './App.css'
import './globals.css'
import openaiLogo from './assets/openai.svg'
import FileSearch from './pages/FileSearch'
// Chat is broken it breaks the import
// import { Chat } from './components/chat'
import { Flex, Text, Box, Button } from "@radix-ui/themes";
import { FileViewer, FilesProvider } from "./components/file-viewer";
import { ClientProvider } from "./components/ai-client";
import { BlocksProvider } from "./components/blocks-context";
import { BlocksComponent } from './components/notebook';

function App() {
  return (
    <>
      <Helmet>
        <title>Cloud Assistant</title>
        <meta name="description" content="An AI Assistant For Your Cloud" />
        <link rel="icon" href={openaiLogo} />
      </Helmet>      

      <FilesProvider>
          <ClientProvider>
              <BlocksProvider>
       <ThreeColumnLayout/>
      </BlocksProvider>
      </ClientProvider>
      </FilesProvider>
    </>
  )
}

export default App

function ThreeColumnLayout() {
  return (
    
    <Box style={{ width: '100%' }}>
      <Flex style={{ width: '100%' }} gap="4" justify="between">
        {/* Column 1 */}
        <Box style={{ flex: 1 }}>
          <h1>How can I help you?</h1>
          {/* <Chat /> */ }
        </Box>

        {/* Column 2 */}
        <Box style={{ flex: 1 }}>
          <h1>Actions</h1>
          <BlocksComponent/>
        </Box>

        {/* Column 3 */}
        <Box style={{ flex: 1 }}>
          <h1>Files</h1>
          <FileViewer/>
        </Box>
      </Flex>
    </Box>    
  );
}
