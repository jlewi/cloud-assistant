import { Helmet } from 'react-helmet'
// import './App.css'
import './globals.css'
import openaiLogo from './assets/openai.svg'
import FileSearch from './pages/FileSearch'
import { Flex, Text, Box, Button } from "@radix-ui/themes";
//import { FilesProvider } from "./components/file-viewer";
import { ClientProvider } from "./components/ai-client";
import { BlocksProvider } from "./components/blocks-context";


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
          <div>
            hello world
            </div>
      </BlocksProvider>
      </ClientProvider>
      </FilesProvider>
    </>
  )
}

export default App

function ThreeColumnLayout() {
  return (
    <>
    <div>
      <h1>Cloud Assistant</h1>
    </div>
    <Box style={{ width: '100%' }}>
      <Flex style={{ width: '100%' }} gap="4" justify="between">
        {/* Column 1 */}
        <Box style={{ flex: 1 }}>
          <FileSearch/>
        </Box>

        {/* Column 2 */}
        <Box style={{ flex: 1 }}>
          <h1>Actions</h1>
          {/* Additional items */}
        </Box>

        {/* Column 3 */}
        <Box style={{ flex: 1 }}>
          Some text
          {/* <FileViewer/> */}
        </Box>
      </Flex>
    </Box>
    </>
  );
}
