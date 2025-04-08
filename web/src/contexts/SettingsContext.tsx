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
}

interface SettingsContextType {
  getDefaultSettings: () => Settings
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
}

const getDefaultSettings = (): Settings => {
  return {
    agentEndpoint:
      window.location.hostname === 'localhost'
        ? 'http://localhost:8080'
        : window.location.origin,
    runnerEndpoint:
      window.location.hostname === 'localhost'
        ? 'ws://localhost:8080/ws'
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
  }
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

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const savedSettings = localStorage.getItem('cloudAssistantSettings')
    return savedSettings
      ? { ...getDefaultSettings(), ...JSON.parse(savedSettings) }
      : getDefaultSettings()
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
