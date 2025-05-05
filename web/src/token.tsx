export const SESSION_COOKIE_NAME = 'cassie-session'

// Returns the value of the session token cookie, or undefined if not found
export function getTokenValue(): string | undefined {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(SESSION_COOKIE_NAME + '='))
  return match?.split('=')[1]
}
