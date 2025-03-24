/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import Markdown from "react-markdown";
// import { RequiredActionFunctionToolCall } from "openai/resources/beta/threads/runs/runs";
import { useFiles } from "./file-viewer";
import { useClient } from "./ai-client";
import { create } from "@bufbuild/protobuf";
import { Button } from "./ui";

//import * as blocks_pb from '../../../protos/gen/es/cassie/blocks_pb'
import * as blocks_pb from "../gen/es/cassie/blocks_pb";
import { v4 as uuidv4 } from 'uuid';
import { Block } from './notebook';

import { useBlocks } from "./blocks-context";

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
};

const UserMessage = ({ text }: { text: string }) => {
  return <div className={styles.userMessage}>{text}</div>;
};

const AssistantMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.assistantMessage}>
      <Markdown>{text}</Markdown>
    </div>
  );
};

const CodeMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.codeMessage}>
      {text.split("\n").map((line, index) => (
        <div key={index}>
          <span>{`${index + 1}. `}</span>
          {line}
        </div>
      ))}
    </div>
  );
};


// Render a block
// Block before switching to monaco
// const Block = ( b : blocks_pb.Block) => {
//   let text = b.contents
//   return (
//     <div className={styles.codeMessage}>
//       {text.split("\n").map((line, index) => (
//         <div key={index}>
//           <span>{`${index + 1}. `}</span>
//           {line}
//         </div>
//       ))}
//     </div>
//   );
// }

const Message = ({ role, text }: MessageProps) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} />;
    case "assistant":
      return <AssistantMessage text={text} />;
    case "code":
      return <CodeMessage text={text} />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (
    toolCall: RequiredActionFunctionToolCall
  ) => Promise<string>;
};

const Chat = ({
  functionCallHandler = () => Promise.resolve(""), // default to return empty string
}: ChatProps) => {
  // Get the AIServe client from the context
  const { client, setClient } = useClient();

  // Access the context
  const filesContext = useFiles(); //

  const blocksContext = useBlocks();

  // User input keeps track of the state in the input element.
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [threadId, setThreadId] = useState("");


  // Keep track of the blocks indexed by their ID.
  //const [blocks, setBlocks] = useState(new Map<string, blocks_pb.Block>());

  // List of block ids in the order they should appear
  //const [blocksPos, setBlockPos] = useState([]);

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // const sendMessage = async (text) => {
  //   console.log("sending message");
  //   const createThread = async () => {      
  //     let aiClient = client;
  //     if (aiClient === null) {
  //       // N.B. when using npm run dev how do we allow this be set to a different value? Since we might be talking to a different server
  //       // TODO(jlewi): I think we could add a settings page stored in webstorage and use that to set the backend.
  //       let baseURL = window.location.origin;
  //       if (window.location.hostname === 'localhost') {
  //         // This is a hack to support local development without requiring the frontend to be served off the same server
  //         // as the backend. This way we can reuse npm's hot reloading.
  //         baseURL = 'http://localhost:8080';
  //       }
  //       console.log(`initializing the client: baseURL ${baseURL}`);
  //       // TODO(jeremy): How do we make this configurable
  //       // TODO(jeremy): Ideally we server the frontend from the backend so we can use the baseHREF
  //       // to get the address of the backend.
  //       // We use gRPCWebTransport because we want server side streaming
  //       const transport = createGrpcWebTransport({
  //         baseUrl: baseURL,
  //       });

  //       // Here we make the client itself, combining the service
  //       // definition with the transport.
  //       let newClient = createClient(blocks_pb.BlocksService, transport);
  //       aiClient = newClient;
  //       setClient(newClient);
  //     }

  //     let blocks: blocks_pb.Block[] = [
  //       create(blocks_pb.BlockSchema, {
  //         kind: blocks_pb.BlockKind.MARKUP,
  //         contents: userInput,
  //         role: blocks_pb.BlockRole.USER,
  //         id: uuidv4(),
  //       }),
  //     ];

  //     // Add the input block to the input
  //     updateBlock(blocks[0])
  //     const req: blocks_pb.GenerateRequest = create(
  //       blocks_pb.GenerateRequestSchema,
  //       {
  //         blocks: blocks,
  //       }
  //     );
  //     console.log("calling generate");
  //     let responses = aiClient.generate(req);

  //     // Streaming response handling
  //     for await (const response of responses) {
  //       console.log(`response has ${response.blocks.length} blocks`)
  //       for (const b of response.blocks) {
  //         if (b.kind == blocks_pb.BlockKind.FILE_SEARCH_RESULTS) {
  //           setBlock(b)
  //         } else {
  //           updateBlock(b)
  //         }
  //       }
  //     }

  //     // Reenable input
  //     setInputDisabled(false);
  //     console.log("Stream ended.");
  //   };  
  //     console.log("calling createThread");
  //     createThread();    
  // };

  // handleSubmit is invoked via form submission when a user enters a query.
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("handleSubmit");
    if (!userInput.trim()) {
      console.log("no user input");
      return;
    }
    sendMessage(userInput);
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: userInput },
    ]);
    setUserInput("");
    setInputDisabled(true);
    scrollToBottom();
  };

  const addBlock = (kind: blocks_pb.BlockKind) => {
    const newBlock = create(blocks_pb.BlockSchema, {
      kind: kind,
      contents: "",
      role: blocks_pb.BlockRole.USER,
      id: uuidv4(),
    })
    blocksContext.updateBlock(newBlock);
  };


  const handleAddMarkupBlock = () => {
    addBlock(blocks_pb.BlockKind.MARKUP);
  };

  const handleAddCodeBlock = () => {
    addBlock(blocks_pb.BlockKind.CODE);
  };


  return (
    <div className={styles.chatContainer}>
      <div className={styles.messages}>
        {blocksContext.blockPositions.map((blockId) => {
          const block = blocksContext.blocks.get(blockId); // Lookup block in the map
          return block ? (
            <Block
              key={block.id}
              block={block}

              onChange={(content) => {
                // Set the contents of the proto associated with this block and 
                // then update it.
                block.contents = content
                blocksContext.updateBlock(block)
              }}
              onRun={() => null}
            //onRun={() => runCode(block.id, block.contents)}
            />

          ) : (
            <p key={blockId}>Block not found: {blockId}</p>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="add-block-button">
        <Button onClick={handleAddMarkupBlock}>Add Markdown Block</Button>
      </div>
      <div className="add-block-button">
        <Button onClick={handleAddCodeBlock}>Add Code Block</Button>
      </div>
    </div>
  );
};

export default Chat;

interface BlockProps {
  block: blocks_pb.Block;
}

const BlockComponent: React.FC<BlockProps> = ({ block }) => {
  if (block.kind == blocks_pb.BlockKind.CODE) {
    return <CodeMessage text={block.contents} />;
  }

  switch (block.role) {
    case blocks_pb.BlockRole.USER:
      return <UserMessage text={block.contents} />;
    case blocks_pb.BlockRole.ASSISTANT:
      return <AssistantMessage text={block.contents} />;
    default:
      return <AssistantMessage text={block.contents} />;
  };
};
