import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { getTokenValue } from '../token'

interface Settings {
  agentEndpoint: string
  runnerEndpoint: string
  requireAuth: boolean
}

interface SettingsContextType {
  settings: Settings
  runnerError: Error | null
  updateSettings: (newSettings: Partial<Settings>) => void
  defaultSettings: Settings
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
)

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

interface SettingsProviderProps {
  children: ReactNode
  requireAuth?: boolean
  webApp?: {
    runner?: string
  }
}

export const SettingsProvider = ({
  children,
  requireAuth,
  webApp,
}: SettingsProviderProps) => {
  const [runnerError, setRunnerError] = useState<Error | null>(null)

  const defaultSettings: Settings = useMemo(() => {
    const isLocalhost = window.location.hostname === 'localhost'
    const isHttp = window.location.protocol === 'http:'
    const isVite = window.location.port === '5173'
    const isDev = isLocalhost && isHttp && isVite

    let runnerLocation = new URL(window.location.href)
    // Overwrite runnerEndpoint if webApp.runner is provided
    if (webApp?.runner) {
      runnerLocation = new URL(webApp.runner)
    }

    const baseSettings: Settings = {
      agentEndpoint: isDev ? 'http://localhost:8080' : window.location.origin,
      runnerEndpoint: isDev
        ? 'ws://localhost:8080/ws'
        : `${runnerLocation.protocol === 'https:' ? 'wss:' : 'ws:'}//${runnerLocation.host}/ws`,
      requireAuth: false,
    }

    // Override requireAuth if provided
    if (requireAuth !== undefined) {
      baseSettings.requireAuth = requireAuth
    }

    return baseSettings
  }, [requireAuth, webApp])

  const [settings, setSettings] = useState<Settings>(() => {
    const savedSettings = localStorage.getItem('cloudAssistantSettings')
    const mergedSettings = savedSettings
      ? { ...defaultSettings, ...JSON.parse(savedSettings) }
      : defaultSettings
    return mergedSettings
  })

  useEffect(() => {
    localStorage.setItem('cloudAssistantSettings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    // Use the same endpoint as the WebSocket but with HTTP
    const endpoint = settings.runnerEndpoint
      .replace('ws://', 'http://')
      .replace('wss://', 'https://')

    const endpointUrl = new URL(endpoint)
    const token = getTokenValue()
    if (token && settings.requireAuth) {
      endpointUrl.searchParams.set('authorization', `Bearer ${token}`)
    }

    fetch(endpointUrl.toString(), {
      method: 'HEAD',
      credentials: 'include', // Include cookies for authentication
      headers: {
        Accept: 'application/json',
      },
    })
      .then((response) => {
        if (response.status === 401) {
          setRunnerError(
            new Error(`${response.status}: ${response.statusText}`)
          )
        } else {
          setRunnerError(null)
        }
      })
      .catch((error) => {
        console.error('Error checking authentication:', error)
        setRunnerError(error)
      })
  }, [requireAuth, settings.requireAuth, settings.runnerEndpoint])

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        runnerError,
        updateSettings,
        defaultSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}
