/**
 * Parse a cookie header string into a key-value object.
 * Handles multiple cookies separated by semicolons.
 *
 * @example
 * parseCookies('auth_token=abc; refresh_token=def')
 * // => { auth_token: 'abc', refresh_token: 'def' }
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      return [name, rest.join('=')];
    })
  );
}

/**
 * Build cookie options string for authentication cookies.
 * Includes HttpOnly, Path=/, SameSite=Lax, Secure (in production), and Max-Age.
 *
 * @param maxAge - Max-Age in seconds (e.g., 900 for 15 minutes, 0 for immediate expiration)
 */
export function buildCookieOptions(maxAge: number): string {
  const options = [
    `HttpOnly`,
    `Path=/`,
    `SameSite=Lax`,
    // Add Secure flag if running in production with HTTPS
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join('; ');
  return options;
}

/**
 * Set authentication cookies (auth_token and refresh_token) with default 15-minute expiration.
 * @param response - ServerResponse object
 * @param accessToken - JWT access token
 * @param refreshToken - JWT refresh token
 */
export function setAuthCookies(
  response: import('node:http').ServerResponse,
  accessToken: string,
  refreshToken: string
): void {
  const cookieOptions = buildCookieOptions(900); // 15 minutes
  response.setHeader('Set-Cookie', [
    `auth_token=${accessToken}; ${cookieOptions}`,
    `refresh_token=${refreshToken}; ${cookieOptions}`,
  ]);
}

/**
 * Clear authentication cookies by setting them with Max-Age=0.
 * @param response - ServerResponse object
 */
export function clearAuthCookies(response: import('node:http').ServerResponse): void {
  const cookieOptions = buildCookieOptions(0);
  response.setHeader('Set-Cookie', [
    `auth_token=; ${cookieOptions}`,
    `refresh_token=; ${cookieOptions}`,
  ]);
}
