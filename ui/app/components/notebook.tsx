import React, { useState, createContext, Dispatch, SetStateAction, useEffect, useRef } from "react";
import { Button, Card, CardContent } from "./ui";
import Editor from "@monaco-editor/react";
//import {BlockComponent } from "./notebook";
import * as blocks_pb from "../../gen/es/cassie/blocks_pb";
import { useClient, CreateBackendClient } from "./ai-client";
import { create } from "@bufbuild/protobuf";
import { useFiles } from "./file-viewer";
import { useBlocks} from "./blocks-context";
import { useClient as useRunmeClient } from "./runme-client";
import * as runner_pb from "../../gen/es/runme/runner/v2/runner_pb";
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
  const filesContext = useFiles();
  
  const blocksContext = useBlocks();

  const runmeContext = useRunmeClient();

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


  const executeBlock = async (block : blocks_pb.Block) => {
    console.log(`sending block ${block.id}`);
    const createThread = async () => {      
      const client = runmeContext.getClient();

      // TODO(jlewi): Should we check its a code cell?
      
      // Add the input block to the input
      //updateBlock(blocks[0])
      const req: runner_pb.ExecuteOneShotRequest = create(
        runner_pb.ExecuteOneShotRequestSchema,
        {
          inputData: new TextEncoder().encode(block.contents),
        }
      );
      
      console.log("calling executeOneshot");
      let responses = client.executeOneShot(req);

      // Streaming response handling
      for await (const response of responses) {        
        // TODO(jlewi): We should add it to the output
        console.log(`stdout has ${response.stdoutData}`)
        console.log(`stderr has ${response.stderrData}`)
                    
        // for (const b of response.blocks) {
        //   if (b.kind == blocks_pb.BlockKind.FILE_SEARCH_RESULTS) {
        //     filesContext.setBlock(b)
        //   } else {
        //     blocksContext.updateBlock(b)
        //   }
        // }
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
              <Button onClick={() => executeBlock(block)}>Run</Button>
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
