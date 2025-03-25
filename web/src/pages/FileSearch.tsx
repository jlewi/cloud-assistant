import { Helmet } from 'react-helmet'

import styles from "./page.module.css";

import Chat from "../components/chat";
import FileViewer from "../components/file-viewer";
import { FilesProvider } from "../components/file-viewer";
import { ClientProvider } from "../components/ai-client";
import { BlocksProvider } from "../components/blocks-context";

const FileSearch = () => {
    return (
        <>            
            <main className={styles.main}>
                <div className={styles.row}>
                    <h1 className={styles.title}>How Can I Help You?</h1>
                </div>
                <FilesProvider>
                    <ClientProvider>
                        <BlocksProvider>
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
                        </BlocksProvider>
                    </ClientProvider>
                </FilesProvider>
            </main>
        </>
    )
}

export default FileSearch
