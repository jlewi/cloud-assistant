import { useSearchParams } from 'react-router-dom'

import { Button, Callout } from '@radix-ui/themes'

export default function Login() {
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const handleLogin = () => {
    // Navigate to /oidc/login to trigger OIDC-flow
    window.location.href = '/oidc/login'
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      {error && (
        <Callout.Root color="red">
          <Callout.Text className="font-bold">Error: "{error}"</Callout.Text>
          {errorDescription && <Callout.Text>{errorDescription}</Callout.Text>}
        </Callout.Root>
      )}
      <Button size="4" onClick={handleLogin} className="cursor-pointer">
        Login
      </Button>
    </div>
  )
}
