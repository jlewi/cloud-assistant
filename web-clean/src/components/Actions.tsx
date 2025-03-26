import { memo, useState } from "react";
import { Box, Button, Card } from "@radix-ui/themes";

import Editor from "@monaco-editor/react";
import Console from "./Runme/Console";
import { v4 as uuidv4 } from 'uuid';

type props = {
  value: string;
  title: string;
};

function RunActionButton({ exitCode, onClick }: { exitCode: number | null, onClick: () => void }) {
  return (
    <Button variant="soft" onClick={onClick}>
      {exitCode === null && (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.24182 2.32181C3.3919 2.23132 3.5784 2.22601 3.73338 2.30781L12.7334 7.05781C12.8974 7.14436 13 7.31457 13 7.5C13 7.68543 12.8974 7.85564 12.7334 7.94219L3.73338 12.6922C3.5784 12.774 3.3919 12.7687 3.24182 12.6782C3.09175 12.5877 3 12.4252 3 12.25V2.75C3 2.57476 3.09175 2.4123 3.24182 2.32181ZM4 3.57925V11.4207L11.4338 7.5L4 3.57925Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" stroke="currentColor" strokeWidth="0.5"></path>
        </svg>
      )}
      {exitCode !== null && exitCode === 0 && (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="#22c55e" fillRule="evenodd" clipRule="evenodd" />
        </svg>
      )}
      {exitCode !== null && exitCode > 0 && (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="20" fill="#ef4444" fillOpacity="0.3" />
          <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#ef4444" fontSize="14" fontWeight="bold">
            {exitCode}
          </text>
        </svg>
      )}
    </Button>
  )
}

const CommandsConsole = memo(({ value, key, outputHandler, exitCodeHandler }: { value: string, key: string, outputHandler: (data: Uint8Array) => void, exitCodeHandler: (code: number) => void }) => {
  return (
    value != "" && key != "" && (
      <Console
        rows={10}
        commands={value.split("\n")}
        onStdout={outputHandler}
        onStderr={outputHandler}
        onExitCode={exitCodeHandler} />
    )
  );
}, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.value) === JSON.stringify(nextProps.value) && prevProps.key === nextProps.key;
});


// Action is an editor and an optional Runme console
function Action({ value, title }: props) {
  let editorValue = value;
  const [exec, setExec] = useState<{ value: string, runID: string }>({ value: "", runID: "" });
  const [exitCode, setExitCode] = useState<number | null>(null);

  const handleRunClick = () => {
    setExec({ value: editorValue, runID: uuidv4() });
  };

  let output = ''
  const outputHandler = (data: Uint8Array): void => {
    output += new TextDecoder().decode(data);
  };

  const exitCodeHandler = (code: number): void => {
    console.log('Output:', output);
    console.log(`Exit code: ${code}`);
    setExitCode(code);
    output = '';
  };

  return (
    <div>
      <Box className="w-full p-2">
        <div className="flex justify-between items-top">
          <RunActionButton exitCode={exitCode} onClick={handleRunClick} />
          <Card className="whitespace-nowrap overflow-hidden flex-1 ml-2">
            <div className="flex items-center m-1">
              <span>{title}</span>
            </div>
            <div className="p-1 h-100px w-full">
              <Editor
                height="100px"
                width="100%"
                defaultLanguage="shellscript"
                value={editorValue ?? value}
                options={{ minimap: { enabled: false }, theme: "vs-dark" }}
                onChange={(v) => editorValue = v || ""}
              />
            </div>
            <CommandsConsole key={exec.runID} value={exec.value} outputHandler={outputHandler} exitCodeHandler={exitCodeHandler} />
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
