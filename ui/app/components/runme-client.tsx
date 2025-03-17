
import React, { createContext, useContext, Dispatch, SetStateAction, useState, useEffect , ReactNode, FC} from "react";
import styles from "./file-viewer.module.css";
import { createClient, Client } from "@connectrpc/connect";
import {
  createGrpcWebTransport,
} from "@connectrpc/connect-web";
// Import service definition that you want to connect to.
import * as runner_pb from "../../gen/es/runme/runner/v2/runner_pb";

type RunnerServiceContextType = {
  client: Client<typeof runner_pb.RunnerService>;
  setClient: Dispatch<SetStateAction<Client<typeof runner_pb.RunnerService>>>;

  // Define additional functions to update the state
  // GetClient returns the client or creates a new one if it doesn't exist
  // TODO(jlewi): Should we make this take an arugment that is the address of the executor?
  getClient: () => Client<typeof runner_pb.RunnerService>;  
}

// Create the context
// We use a context to make the client available to all components in the tree.
const ClientContext = createContext<RunnerServiceContextType>({
  client: null,
  setClient: () => {}, // A no-op function, which will be replaced by the provider  
  getClient: () => {return null}, // Provide a no-op default
  }
);

// Custom hook to use the client
export const useClient = () => {
  return useContext(ClientContext);
};

// Provider component
export const ClientProvider: FC<{ children: ReactNode }>  = ({ children }) => {
  const [client, setClient] = useState(null);

  // getClient returns the client or creates one if it doesn't already exist
  const getClient = () => {
    // N.B. when using npm run dev how do we allow this be set to a different value? Since we might be talking to a different server
    // TODO(jlewi): I think we could add a settings page stored in webstorage and use that to set the backend.
    let baseURL = window.location.origin;
    if (window.location.hostname === 'localhost') {
      // This is a hack to support local development without requiring the frontend to be served off the same server
      // as the backend. This way we can reuse npm's hot reloading.
      baseURL = 'http://localhost:8080';
    }
    console.log(`initializing the client: baseURL ${baseURL}`);
    // TODO(jeremy): How do we make this configurable
    // TODO(jeremy): Ideally we server the frontend from the backend so we can use the baseHREF
    // to get the address of the backend.
    // We use gRPCWebTransport because we want server side streaming
    const transport = createGrpcWebTransport({
      baseUrl: baseURL,
    });
  
    // Here we make the client itself, combining the service
    // definition with the transport.
    let newClient = createClient(runner_pb.RunnerService, transport);
    return newClient;
  }

  return (
    <ClientContext.Provider value={{ client, setClient, getClient }}>
      {children}
    </ClientContext.Provider>
  );
};


