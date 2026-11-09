import { UserRole, UserSession } from '../types';
import { API_BASE_URL } from './apiConfig';
import { ApiError, fetchWithTimeout, readApiResponse } from './apiRequest';

interface AuthPayload {
  access_token: string;
  user: Omit<UserSession, 'loginAt'>;
}

export interface AuthResult {
  token: string;
  user: UserSession;
}

async function authRequest<T>(path: string, body: Record<string, string>): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readApiResponse<T>(response);
}

function toAuthResult(payload: AuthPayload): AuthResult {
  if (!payload || !payload.access_token || !payload.user?.userId || !payload.user?.identifier || !payload.user?.role) {
    throw new Error('Format respons autentikasi dari server tidak sesuai.');
  }
  return { token: payload.access_token, user: { ...payload.user, loginAt: new Date().toISOString() } };
}

export async function loginRequest(identifier: string, password: string, role: UserRole): Promise<AuthResult> {
  return toAuthResult(await authRequest<AuthPayload>('/auth/login', { identifier, password, role }));
}

export async function registerRequest(name: string, identifier: string, password: string, role: UserRole): Promise<AuthResult> {
  return toAuthResult(await authRequest<AuthPayload>('/auth/register', { name, identifier, password, role }));
}

export async function logoutRequest(token: string): Promise<void> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 401) await readApiResponse<void>(response);
  } catch {
    // Local logout must still complete when the server cannot be reached.
  }
}

export async function validateToken(token: string): Promise<Omit<UserSession, 'loginAt'> | null> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/session`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) return null;
  const payload = await readApiResponse<{ user?: Omit<UserSession, 'loginAt'> }>(response);
  return payload?.user ?? null;
}
