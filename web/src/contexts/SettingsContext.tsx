import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

interface Settings {
  agentEndpoint: string
  runnerEndpoint: string
  requireAuth: boolean
}

interface SettingsContextType {
  settings: Settings
  runnerAuthError: Error | null
  updateSettings: (newSettings: Partial<Settings>) => void
  getDefaultSettings: () => Settings
}

const getDefaultSettings = (): Settings => ({
  agentEndpoint:
    window.location.hostname === 'localhost'
      ? 'http://localhost:8080'
      : window.location.origin,
  runnerEndpoint:
    window.location.hostname === 'localhost'
      ? 'ws://localhost:8080/ws'
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
  requireAuth: false,
})

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
}

export const SettingsProvider = ({
  children,
  requireAuth,
}: SettingsProviderProps) => {
  const [runnerAuthError, setRunnerAuthError] = useState<Error | null>(null)
  const [settings, setSettings] = useState<Settings>(() => {
    const savedSettings = localStorage.getItem('cloudAssistantSettings')
    const defaultSettings = getDefaultSettings()
    const mergedSettings = savedSettings
      ? { ...defaultSettings, ...JSON.parse(savedSettings) }
      : defaultSettings

    // Override requireAuth if provided
    if (requireAuth !== undefined) {
      mergedSettings.requireAuth = requireAuth
    }

    return mergedSettings
  })

  useEffect(() => {
    localStorage.setItem('cloudAssistantSettings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (!requireAuth) {
      return
    }

    // Use the same endpoint as the WebSocket but with HTTP
    const endpoint = settings.runnerEndpoint
      .replace('ws://', 'http://')
      .replace('wss://', 'https://')

    fetch(endpoint, {
      method: 'HEAD',
      credentials: 'include', // Include cookies for authentication
      headers: {
        Accept: 'application/json',
      },
    })
      .then((response) => {
        if (response.status === 401) {
          setRunnerAuthError(
            new Error(`${response.status}: ${response.statusText}`)
          )
        } else {
          setRunnerAuthError(null)
        }
      })
      .catch((error) => {
        console.error('Error checking authentication:', error)
        setRunnerAuthError(error)
      })
  }, [requireAuth, settings.runnerEndpoint])

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        runnerAuthError,
        updateSettings,
        getDefaultSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}
