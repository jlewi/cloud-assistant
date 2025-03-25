import React, { createContext, useContext, Dispatch, SetStateAction, useState, useEffect , ReactNode, FC} from "react";
import styles from "./file-viewer.module.css";
import * as blocks_pb from "../../gen/es/cassie/blocks_pb";

// FileSearchResult is used to hold the values in the result of the FileSearchToolcall.
// TODO(jlewi): Does the TS SDK define this type already?
export type FileSearchResult = {
  file_id: string;
  file_name: string;
  score: number;
};


type FilesContextType = {
  block: blocks_pb.Block | null;
  setBlock: Dispatch<SetStateAction<blocks_pb.Block | null>>;
}
const FilesContext = createContext<FilesContextType>({
  block: null,
  setBlock: () => {},
  }
);

export const FilesProvider: FC<{ children: ReactNode }>  = ({ children }) => {
  const [block, setBlock] = useState(null);


  return (
    <FilesContext.Provider value={{ block, setBlock }}>
      {children}
    </FilesContext.Provider>
  );
};


export const useFiles = () => {
  return useContext(FilesContext);
};

const FileViewer = () => {
  const { block } = useFiles();

  if (!block || !block.fileSearchResults) {
    return null; // Or render a default UI indicating no data available
  }

  return (
    <div className={styles.fileViewer}>
      <h1> Files </h1>
      <div
        className={`${styles.filesList} ${
          block.fileSearchResults.length !== 0 ? styles.grow : ""
        }`}
      >
        {block.fileSearchResults.length === 0 ? (
          <div className={styles.title}>No Search Results</div>
        ) : (
          block.fileSearchResults.map((result) => {
            return (            
              <div key={result.Link} className={styles.fileEntry}>
                <div className={styles.fileName}>
                  <span className={styles.fileName}><a href={result.Link} target="_blank">{result.FileName}</a></span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
