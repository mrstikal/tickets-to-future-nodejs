const SESSION_STORAGE_KEY = 'tickets-to-future-session';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateSessionId(): string {
  return `s_${crypto.randomUUID()}`;
}

type StoredSession = {
  id: string;
  createdAt: number;
};

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return 's_server';
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (raw) {
      const parsed: StoredSession = JSON.parse(raw);
      if (parsed?.id && typeof parsed.createdAt === 'number') {
        const age = Date.now() - parsed.createdAt;
        if (age < SESSION_EXPIRY_MS) {
          return parsed.id;
        }
      }
    }
  } catch {
    // If parsing fails, fall through and create a fresh session
    console.warn('Failed to read session from localStorage, generating a new one');
  }

  const nextSessionId = generateSessionId();
  const stored: StoredSession = { id: nextSessionId, createdAt: Date.now() };
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore quota errors
  }

  return nextSessionId;
}