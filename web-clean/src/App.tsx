// import { useState } from 'react'
import Layout from './layout'
import { Helmet } from 'react-helmet'
import { Theme } from "@radix-ui/themes";

import Chat from "./components/Placeholder";
import BlocksComponent from "./components/Placeholder";
import FileViewer from "./components/Placeholder";

import openaiLogo from './assets/openai.svg'
import "@radix-ui/themes/styles.css";

function App() {
  return (<>
    <Theme>
      <Helmet>
        <title>Cloud Assistant</title>
        <meta name="description" content="An AI Assistant For Your Cloud" />
        <link rel="icon" href={openaiLogo} />
      </Helmet>
      <Layout
        left={<Chat />}
        middle={<BlocksComponent />}
        right={<FileViewer />}
      />
    </Theme>
  </>)
}

export default App
