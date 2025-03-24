import { Helmet } from 'react-helmet'
// import './App.css'
import './globals.css'
import openaiLogo from './assets/openai.svg'
import FileSearch from './pages/FileSearch'

function App() {
  return (
    <>
      <Helmet>
        <title>OpenAI's Cloud Assistant (go/act)</title>
        <meta name="description" content="A quickstart template using the Assistants API with OpenAI" />
        <link rel="icon" href={openaiLogo} />
      </Helmet>
      <div className="app-container">
        {/* add router later */}
        <FileSearch />
      </div>
    </>
  )
}

export default App
