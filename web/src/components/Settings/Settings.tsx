import { ChangeEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Box, Button, Flex, Text, TextArea } from '@radix-ui/themes'

import { useSettings } from '../../contexts/SettingsContext'

export default function Settings() {
  const navigate = useNavigate()
  const { settings, updateSettings, getDefaultSettings } = useSettings()
  const [endpoint, setEndpoint] = useState(settings.agentEndpoint)
  const [runnerEndpoint, setRunnerEndpoint] = useState(settings.runnerEndpoint)

  const handleSave = () => {
    updateSettings({
      agentEndpoint: endpoint,
      runnerEndpoint: runnerEndpoint,
    })
    navigate('/')
  }

  const handleRevert = () => {
    const defaultSettings = getDefaultSettings()
    setEndpoint(defaultSettings.agentEndpoint)
    setRunnerEndpoint(defaultSettings.runnerEndpoint)
  }

  const isChanged =
    endpoint !== settings.agentEndpoint ||
    runnerEndpoint !== settings.runnerEndpoint

  return (
    <Box className="w-full mx-auto">
      <Text size="5" weight="bold" className="mb-2">
        Settings
      </Text>

      <Box className="mt-4">
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="2">
            <Text size="3" weight="bold">
              Agent Endpoint Configuration
            </Text>
            <Text size="2" color="gray">
              Configure the endpoint URL for the AI agent. Changes will take
              effect after saving.
            </Text>
            <TextArea
              size="3"
              placeholder="Enter AI endpoint URL"
              value={endpoint}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setEndpoint(e.target.value)
              }
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text size="3" weight="bold">
              Runner Endpoint Configuration
            </Text>
            <Text size="2" color="gray">
              Configure the WebSocket endpoint URL for the runner. Changes will
              take effect after saving.
            </Text>
            <TextArea
              size="3"
              placeholder="Enter Runner WebSocket endpoint URL"
              value={runnerEndpoint}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setRunnerEndpoint(e.target.value)
              }
            />
            <Text size="2" color="gray">
              Revert will reset to the default value, including protocol
              http(s), based on the current page.
            </Text>
          </Flex>
        </Flex>

        <Flex gap="3" justify="end" mt="4">
          <Button size="2" variant="soft" onClick={() => navigate('/')}>
            Back
          </Button>
          <Button size="2" variant="soft" onClick={handleRevert}>
            Revert
          </Button>
          <Button size="2" onClick={handleSave} disabled={!isChanged}>
            Save
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}
