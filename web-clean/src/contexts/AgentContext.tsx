import {
  Dispatch,
  FC,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import { Client, createClient } from '@connectrpc/connect'
import { createGrpcWebTransport } from '@connectrpc/connect-web'

// Should we rename this to Blocks* vs Agent*?
import * as blocks_pb from '../gen/es/cassie/blocks_pb'

type AgentClient = Client<typeof blocks_pb.BlocksService>

type AgentServiceContextType = {
  client?: AgentClient
  setClient: Dispatch<SetStateAction<AgentClient | undefined>>
}

// Create the context
// We use a context to make the client available to all components in the tree.
const ClientContext = createContext<AgentServiceContextType>({
  setClient: () => {}, // A no-op function, which will be replaced by the provider
})

// Custom hook to use the client
// eslint-disable-next-line react-refresh/only-export-components
export const useClient = () => {
  const context = useContext(ClientContext)
  if (context === undefined) {
    throw new Error('useClient must be used within a AgentClientProvider')
  }
  return context
}

// Provider component
export const AgentClientProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [client, setClient] = useState<AgentClient | undefined>()

  useEffect(() => {
    setClient(createAgentClient())
  }, [])

  return (
    <ClientContext.Provider value={{ client, setClient }}>
      {children}
    </ClientContext.Provider>
  )
}

// CreateAgentClient creates a client to to talk to the backend.
//
// TODO(jlewi): I think we could define this function in the AgentClientProvider it could then create and set
// the client in the context. This function would then be passed down via the provider so callers
// wouldn't need to have to call it and then setClient in order to set the client
export function createAgentClient(): AgentClient {
  // N.B. when using npm run dev how do we allow this be set to a different value? Since we might be talking to a different server
  // TODO(jlewi): I think we could add a settings page stored in webstorage and use that to set the backend.
  let baseURL = window.location.origin
  if (window.location.hostname === 'localhost') {
    // This is a hack to support local development without requiring the frontend to be served off the same server
    // as the backend. This way we can reuse npm's hot reloading.
    baseURL = 'http://localhost:8080'
  }
  console.log(`initializing the client: baseURL ${baseURL}`)
  // TODO(jeremy): How do we make this configurable
  // TODO(jeremy): Ideally we server the frontend from the backend so we can use the baseHREF
  // to get the address of the backend.
  // We use gRPCWebTransport because we want server side streaming
  const transport = createGrpcWebTransport({
    baseUrl: baseURL,
  })

  // Here we make the client itself, combining the service
  // definition with the transport.
  return createClient(blocks_pb.BlocksService, transport)
}
