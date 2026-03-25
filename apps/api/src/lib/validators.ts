/**
 * Utility functions for input validation
 */

/**
 * Validates email format using regex
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates if string is valid UUID v4
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validates positive integer
 */
export function validatePositiveInteger(value: string | number): number | null {
  const num = parseInt(String(value), 10);
  if (isNaN(num) || num < 1) {
    return null;
  }
  return num;
}

/**
 * Validates session ID length/format (simple check)
 */
export function validateSessionId(sessionId: string): boolean {
  return sessionId.length >= 10 && sessionId.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(sessionId);
}