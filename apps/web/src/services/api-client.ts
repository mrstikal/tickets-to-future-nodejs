import { config } from '@/lib/config';
import { refreshToken as refreshTokenService } from './auth-service';

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

async function assertSuccess(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  let payload: ApiErrorPayload | null = null;

  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    // no-op, fallback to generic status message
  }

  const message =
    payload?.error?.message || `API request failed: ${response.status}`;

  throw new Error(message);
}

async function tryRefresh(): Promise<boolean> {
  try {
    // backend expects refresh token in HttpOnly cookie
    await refreshTokenService();
    return true;
  } catch {
    return false;
  }
}

async function fetchWithRefresh(input: RequestInfo, init?: RequestInit, retry = true): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status !== 401) {
    return response;
  }

  if (!retry) {
    return response;
  }

  const refreshed = await tryRefresh();
  if (!refreshed) {
    return response;
  }

  // retry original request once after refresh
  return fetch(input, init);
}

export async function apiPut<TResponse, TBody>(
  path: string,
  body: TBody
): Promise<TResponse> {
  const response = await fetchWithRefresh(`${config.apiBaseUrl}${path}`, {
    method: 'PUT',
    headers: createHeaders(),
    cache: 'no-store',
    credentials: 'include',
    body: JSON.stringify(body),
  });

  await assertSuccess(response);

  return response.json() as Promise<TResponse>;
}

function createHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetchWithRefresh(`${config.apiBaseUrl}${path}`, {
    headers: createHeaders(),
    cache: 'no-store',
    credentials: 'include',
  });

  await assertSuccess(response);

  return response.json() as Promise<T>;
}

export async function apiPost<TResponse, TBody>(
  path: string,
  body: TBody
): Promise<TResponse> {
  const response = await fetchWithRefresh(`${config.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: createHeaders(),
    cache: 'no-store',
    credentials: 'include',
    body: JSON.stringify(body),
  });

  await assertSuccess(response);

  return response.json() as Promise<TResponse>;
}

export async function apiDelete<TResponse>(path: string): Promise<TResponse> {
  const response = await fetchWithRefresh(`${config.apiBaseUrl}${path}`, {
    method: 'DELETE',
    headers: createHeaders(),
    cache: 'no-store',
    credentials: 'include',
  });

  await assertSuccess(response);

  if (response.status === 204) {
    // No content to parse
    return undefined as unknown as TResponse;
  }

  return response.json() as Promise<TResponse>;
}
