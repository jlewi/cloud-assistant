import React from 'react';
import Chat from "../components/chat";
import FileViewer from "../components/file-viewer";
import { FilesProvider } from "../components/file-viewer";
import { ClientProvider, useClient } from "../components/ai-client";
import {BlocksProvider} from "../components/blocks-context";
import { ClientProvider as RunmeProvider}  from "../components/runme-client";

const Home: React.FC = () => {
  return (
    <>
    <Head>
    <title>Cloud Assistant</title>
    </Head>
    <main className={styles.main}>
      <div className={styles.row}>
      <h1 className={styles.title}>Cloud Assistant</h1>
      </div>
      <FilesProvider>
      <ClientProvider>        
      <BlocksProvider>
      <RunmeProvider>
      <div className={styles.container}>          
        <div className={styles.column}>
          <FileViewer />
        </div>
        {/* <div className={styles.chatContainer}>
          <div className={styles.chat}>
            <NotebookEditor />
          </div>
        </div> */}
        <div className={styles.chatContainer}>
          <div className={styles.chat}>
            <Chat />
          </div>
        </div>
      </div>
      </RunmeProvider>
      </BlocksProvider>
      </ClientProvider>
      </FilesProvider>
    </main>
  </>
  );
};

export default Home;