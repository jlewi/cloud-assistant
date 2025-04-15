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
  updateSettings: (newSettings: Partial<Settings>) => void
  getDefaultSettings: () => Settings
}

const getDefaultSettings = (): Settings => ({
  agentEndpoint:
    window.location.protocol === 'https:'
      ? 'https://agent.example.com'
      : 'http://agent.example.com',
  runnerEndpoint:
    window.location.protocol === 'https:'
      ? 'wss://runner.example.com'
      : 'ws://runner.example.com',
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

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, getDefaultSettings }}
    >
      {children}
    </SettingsContext.Provider>
  )
}
