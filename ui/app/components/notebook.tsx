import React, { useState, createContext, Dispatch, SetStateAction, useEffect, useRef } from "react";
import { Button, Card, CardContent } from "./ui";
import Editor from "@monaco-editor/react";
//import {BlockComponent } from "./notebook";
import * as blocks_pb from "../../gen/es/cassie/blocks_pb";
import { useClient, CreateBackendClient } from "./ai-client";
import { create } from "@bufbuild/protobuf";
import { useFiles } from "./file-viewer";
import { useBlocks} from "./blocks-context";

// Define BlocksContext
export type BlocksContextType = {
  blocks: blocks_pb.Block[];
  setBlocks: Dispatch<SetStateAction<blocks_pb.Block[]>>;
};

export const BlocksContext = createContext<BlocksContextType>({
  blocks: [],
  setBlocks: () => {},
});

const defaultCode = `console.log('Hello, world!');`;
const defaultMarkdown = `# Markdown Block\nWrite **markdown** here.`;
const defaultExecutors = ["https://localhost:8090"];

const BlockOutput = ({ outputs }) => {
  if (!outputs?.length) return null;

  return (
    <div className="block-output">
      <strong>Output:</strong>
      <pre>
        {outputs
          .flatMap((output) =>
            output.items.map((item) => item.text_data)
          )
          .join("\n")}
      </pre>
    </div>
  );
};

// BlockProps defines the properties of the Block component.
interface BlockProps {
    // Block is the proto buffer containing/storing all the data that will be rendered in this
    // component.
    block: blocks_pb.Block;
    // onChange is the handler to invoke when the content changes.
    // TODO(jlewi) : Is this where we update the contents of the proto?
    onChange: (value: any) => void;  // Update type as necessary
    // onRun is the function that is executed when the run button is clicked.
    // TODO(jlewi): I don't think we need to pass in an onRun function
    // because the behavior of what to do will be determined by the block type.
    onRun: () => void;    
  }
  

export const Block: React.FC<BlockProps>= ({ block, onChange, onRun }) => {
  const editorRef = useRef(null);
  const [executor, setExecutor] = useState(defaultExecutors[0]);

    // Access the context
    const filesContext = useFiles(); //
    
    const blocksContext = useBlocks();

  // Get the AIServe client from the context
  const { client, setClient } = useClient();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onRun();
      }
    };

    const editorDomNode = editorRef.current;
    if (editorDomNode) {
      editorDomNode.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      if (editorDomNode) {
        editorDomNode.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [onRun]);

  const handleKindChange = (e) => {
    const newKind = Number(e.target.value);
    const newLanguage = newKind === 2 ? "javascript" : "markdown";
    onChange(block.contents); // Keep contents
    block.kind = newKind;
    block.language = newLanguage;
  };

  // sendBlockToAssistant sends a block to the Assistant for processing.
  // TODO(jlewi): Add support for sending outputs
  const sendBlockToAssistant = async (block : blocks_pb.Block) => {
    console.log(`sending block ${block.id}`);
    const createThread = async () => {      
      let aiClient = client;
      if (aiClient === null) {       
        aiClient = CreateBackendClient();
        setClient(aiClient);
      }

    //   let blocks: blocks_pb.Block[] = [
    //     create(blocks_pb.BlockSchema, {
    //       kind: blocks_pb.BlockKind.MARKUP,
    //       contents: userInput,
    //       role: blocks_pb.BlockRole.USER,
    //       id: uuidv4(),
    //     }),
    //   ];

    let blocks: blocks_pb.Block[] = [block];
      // Add the input block to the input
      //updateBlock(blocks[0])
      const req: blocks_pb.GenerateRequest = create(
        blocks_pb.GenerateRequestSchema,
        {
          blocks: blocks,
        }
      );
      console.log("calling generate");
      let responses = aiClient.generate(req);

      // Streaming response handling
      for await (const response of responses) {
        console.log(`response has ${response.blocks.length} blocks`)
        for (const b of response.blocks) {
          if (b.kind == blocks_pb.BlockKind.FILE_SEARCH_RESULTS) {
            filesContext.setBlock(b)
          } else {
            blocksContext.updateBlock(b)
          }
        }
      }

      // Reenable input
      //setInputDisabled(false);
      console.log("Stream ended.");
    };  
    
    //console.log("calling createThread");
    createThread();
    
  };

  return (
    <Card className="block-card">
      <CardContent className="block-card-content" ref={editorRef}>
        <Editor
          height="200px"
          defaultLanguage={block.language || (block.kind === blocks_pb.BlockKind.CODE ? "bash" : "markdown")}
          value={block.contents}
          onChange={(value) => onChange(value || "")}
          options={{ minimap: { enabled: false }, theme: "vs-dark" }}
        />
        <div className="run-button-container">
            <Button onClick={() => sendBlockToAssistant(block)}>Send</Button>
        </div>
            
        {block.kind === blocks_pb.BlockKind.CODE && (
          <>
            <div className="run-button-container">
              <Button onClick={onRun}>Run</Button>
            </div>
            
            {/* TODO(jlewi): need to render the outputs
            <BlockOutput outputs={block.outputs}/> 
            */}
          </>
        )}
        <div className="block-controls">
          <div className="executor-selector">
            <label htmlFor={`executor-${block.id}`}>Executor:</label>
            <input
              id={`executor-${block.id}`}
              list={`executors-${block.id}`}
              value={executor}
              onChange={(e) => setExecutor(e.target.value)}
            />
            <datalist id={`executors-${block.id}`}>
              {defaultExecutors.map((url) => (
                <option key={url} value={url} />
              ))}
            </datalist>
          </div>
          <div className="block-kind-selector">
            <label htmlFor={`kind-${block.id}`}>Block Type:</label>
            <select
              id={`kind-${block.id}`}
              value={block.kind}
              onChange={handleKindChange}
            >
              <option value={1}>Markdown</option>
              <option value={2}>Code</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// const NotebookEditor = () => {
//   const [blocks, setBlocks] = useState<blocks_pb.Block[]>([]);

//   const addBlock = () => {
//     const newBlock: blocks_pb.Block = {
//       id: Date.now().toString(),
//       kind: 2,
//       language: "javascript",
//       contents: defaultCode,
//       outputs: [],
//       metadata: {},
//       role: 1,
//       file_search_results: [],
//     };
//     setBlocks((prev) => [...prev, newBlock]);
//   };

//   const updateBlock = (id: string, newContent: string) => {
//     setBlocks((prev) =>
//       prev.map((block) =>
//         block.id === id ? { ...block, contents: newContent } : block
//       )
//     );
//   };

//   const runCode = (id: string, code: string) => {
//     const log: string[] = [];
//     const originalConsoleLog = console.log;
//     console.log = (...args) => {
//       log.push(args.join(" "));
//       originalConsoleLog(...args);
//     };

//     try {
//       // eslint-disable-next-line no-eval
//       eval(code);
//     } catch (error) {
//       log.push("Error: " + error.message);
//     }

//     console.log = originalConsoleLog;
//     const outputItem = {
//       mime: "text/plain",
//       text_data: log.join("\n"),
//     };
//     const output = {
//       items: [outputItem],
//     };
//     setBlocks((prev) =>
//       prev.map((block) =>
//         block.id === id ? { ...block, outputs: [output] } : block
//       )
//     );
//   };

//   return (
//     <BlocksContext.Provider value={{ blocks, setBlocks }}>
//       <div className="notebook-editor">
//         <div className="blocks">
//         {blocks.map((block) => (
//           <Block
//             key={block.id}
//             block={block}
//             onChange={(content) => updateBlock(block.id, content)}
//             onRun={() => runCode(block.id, block.contents)}
//           />
//         ))}
//         </div>
//         <div className="add-block-button">
//           <Button onClick={addBlock}>Add Block</Button>
//         </div>
//       </div>
//     </BlocksContext.Provider>
//   );
// };

// export default NotebookEditor;
