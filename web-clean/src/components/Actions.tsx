import { useState } from "react";
import { Box, Button, Card } from "@radix-ui/themes";

import Editor from "@monaco-editor/react";
import Console from "./Runme/Console";

type props = {
  value: string;
  title: string;
};

// Action is an editor and an optional Runme console
function Action({ value, title }: props) {
  let editorValue = value;
  const [execCommands, setExecCommands] = useState<string[] | null>(null);

  const handleRunClick = () => {
    const commands = editorValue.split("\n");
    setExecCommands(commands);
  };

  let output = ''
  const outputHandler = (data: Uint8Array): void => {
    output += new TextDecoder().decode(data);
  };

  const exitCodeHandler = (code: number): void => {
    console.log('Output:', output);
    console.log(`Exit code: ${code}`);
    output = '';
  };

  return (
    <div>
      <Box className="w-full p-2">
        <div className="flex justify-between items-top">
          <Button variant="soft" onClick={handleRunClick}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.24182 2.32181C3.3919 2.23132 3.5784 2.22601 3.73338 2.30781L12.7334 7.05781C12.8974 7.14436 13 7.31457 13 7.5C13 7.68543 12.8974 7.85564 12.7334 7.94219L3.73338 12.6922C3.5784 12.774 3.3919 12.7687 3.24182 12.6782C3.09175 12.5877 3 12.4252 3 12.25V2.75C3 2.57476 3.09175 2.4123 3.24182 2.32181ZM4 3.57925V11.4207L11.4338 7.5L4 3.57925Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" stroke="currentColor" strokeWidth="0.5"></path>
            </svg>
          </Button>
          <Card className="whitespace-nowrap overflow-hidden flex-1 ml-2">
            <div className="flex items-center m-1">
              <span>{title}</span>
            </div>
            <div className="p-1 h-100px w-full">
              <Editor
                height="100px"
                width="100%"
                defaultLanguage="shellscript"
                value={editorValue}
                options={{ minimap: { enabled: false }, theme: "vs-dark" }}
                onChange={(value) => editorValue = value || ""}
              />
            </div>
            <div className="p-1">
              {execCommands && (
                <Console
                  rows={10}
                  commands={execCommands}
                  onStdout={outputHandler}
                  onStderr={outputHandler}
                  onExitCode={exitCodeHandler}
                />
              )}
            </div>
          </Card>
        </div>
      </Box>
    </div>
  )
}

export default function Actions() {
  // should come out of Context
  const dummies = [
    {
      title: "To begin, let's use shell to say hello",
      value: "echo 'Hello, world!'",
    },
    {
      title: "What's the time?",
      value: "date",
    },
    {
      title: "Here are the nodes in your cluster",
      value: "kubectl get nodes",
    },
  ];
  return (
    <>
      {dummies.map((dummy, index) => (
        <Action key={index} {...dummy} />
      ))}
    </>
  );
}
