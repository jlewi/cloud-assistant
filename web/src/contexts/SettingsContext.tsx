import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Subscription } from 'rxjs'
import { ulid } from 'ulid'

import Streams, {
  Heartbeat,
  StreamError,
  genRunID,
} from '../components/Runme/Streams'

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

    // reset runner error
    setRunnerError(null)

    const stream = new Streams(
      `check_${ulid()}`,
      genRunID(),
      settings.runnerEndpoint
    )

    const subs: Subscription[] = []
    subs.push(
      stream.errors.subscribe({
        next: (error) => setRunnerError(error),
      })
    )
    subs.push(
      stream.connect(Heartbeat.INITIAL).subscribe((l) => {
        if (l === null) {
          return
        }
        console.log(
          `Initial heartbeat latency for streamID ${l.streamID} (${l.readyState === 1 ? 'open' : 'closed'}): ${l.latency}ms`
        )
        stream.close()
      })
    )

    return () => {
      subs.forEach((sub) => sub.unsubscribe())
    }
  }, [settings.runnerEndpoint])

  useEffect(() => {
    checkRunnerAuth()
  }, [checkRunnerAuth])

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
