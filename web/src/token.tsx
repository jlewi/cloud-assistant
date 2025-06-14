import { fromJson } from '@bufbuild/protobuf'
import { create } from '@bufbuild/protobuf'

import { OAuthToken, OAuthTokenSchema } from './gen/es/cassie/credentials_pb'

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
export function getAccessToken(): OAuthToken {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(OAUTH_COOKIE_NAME + '='))

  // Cookie value should be the JSON version of the proto OAuthToken
  const value = match?.split('=')[1]
  let token: OAuthToken = create(OAuthTokenSchema)

  if (!value) {
    return token
  }

  try {
    // Unescape the URL-encoded value
    const jsonStr = decodeURIComponent(value)
    // Parse the string into an object
    const parsed = JSON.parse(jsonStr)

    // Parse the payload into a Protobuf message
    token = fromJson(OAuthTokenSchema, parsed)
  } catch (err) {
    console.error('Failed to parse OAuthToken:', err)
  }

  return token
}
