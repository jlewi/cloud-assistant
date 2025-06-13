export const SESSION_COOKIE_NAME = 'cassie-session'
export const OAUTH_COOKIE_NAME = 'cassie-oauth-token'

// Returns the value of the session token cookie, or undefined if not found
export function getTokenValue(): string | undefined {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(SESSION_COOKIE_NAME + '='))
  return match?.split('=')[1]
}

// Returns the value of the oauth access token.
export function getAccessToken(): string | undefined {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(SESSION_COOKIE_NAME + '='))

  // Cookie value should be the JSON version of the proto OAuthToken
  const value = match?.split('=')[1]

  if (!value) {
    return undefined
  }

  try {
    // Do we need decoeURIComponent here to properly decode the cookie value?
    const tokenObj = JSON.parse(decodeURIComponent(value))
    return tokenObj.accessToken
  } catch (e) {
    console.error('Failed to parse access token from cookie:', e)
    return undefined
  }
}
