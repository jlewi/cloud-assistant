import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { ulid } from 'ulid'

import Stream, { StreamError, genRunID } from '../components/Runme/Stream'

interface Settings {
  agentEndpoint: string
  runnerEndpoint: string
  requireAuth: boolean
}

interface SettingsContextType {
  checkRunnerAuth: () => void
  defaultSettings: Settings
  runnerError: StreamError | null
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
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
  const [runnerError, setRunnerError] = useState<StreamError | null>(null)

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

  const checkRunnerAuth = useCallback(async () => {
    if (!settings.runnerEndpoint) {
      return
    }
    const stream = new Stream(ulid(), genRunID(), settings.runnerEndpoint)
    stream.errors.subscribe((error) => {
      console.log(new Date(), 'Runner error', error)
      setRunnerError(error)
    })
  }, [settings.runnerEndpoint])

  useEffect(() => {
    if (!settings.requireAuth) {
      return
    }

    checkRunnerAuth()
  }, [checkRunnerAuth, settings.requireAuth])

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }

  return (
    <SettingsContext.Provider
      value={{
        checkRunnerAuth,
        defaultSettings,
        runnerError,
        settings,
        updateSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}
