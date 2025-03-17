import React, { createContext, useContext, Dispatch, SetStateAction, useState, useEffect , ReactNode, FC} from "react";
import styles from "./file-viewer.module.css";

import { createClient, Client } from "@connectrpc/connect";
import {
  createGrpcWebTransport,
} from "@connectrpc/connect-web";
// Import service definition that you want to connect to.
import * as blocks_pb from "../../gen/es/cassie/blocks_pb";

type AIServiceContextType = {
  client: Client<typeof blocks_pb.BlocksService>;
  setClient: Dispatch<SetStateAction<Client<typeof blocks_pb.BlocksService>>>;
}

// Create the context
// We use a context to make the client available to all components in the tree.
const ClientContext = createContext<AIServiceContextType>({
  client: null,
  setClient: () => {}, // A no-op function, which will be replaced by the provider  
  }
);

// Custom hook to use the client
export const useClient = () => {
  return useContext(ClientContext);
};

// Provider component
export const ClientProvider: FC<{ children: ReactNode }>  = ({ children }) => {
  const [client, setClient] = useState(null);


  return (
    <ClientContext.Provider value={{ client, setClient }}>
      {children}
    </ClientContext.Provider>
  );
};

// CreateBackendClient creates a client to to talk to the backend.
// 
// TODO(jlewi): I think we could define this function in the ClientProvider it could then create and set
// the client in the context. This function would then be passed down via the provider so callers 
// wouldn't need to have to call it and then setClient in order to set the client
export function CreateBackendClient() : Client<typeof blocks_pb.BlocksService> {
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
  let newClient = createClient(blocks_pb.BlocksService, transport);
  return newClient;
}
