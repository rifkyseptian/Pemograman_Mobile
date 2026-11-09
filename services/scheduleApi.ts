import { ScheduleItem } from '../types';
import { secureStorage, SECURE_KEYS } from './secureStorage';
import { API_BASE_URL } from './apiConfig';
import { ApiError, fetchWithTimeout, readApiResponse } from './apiRequest';

export type ScheduleInput = Omit<ScheduleItem, 'id'>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await secureStorage.getSensitiveItem<string>(SECURE_KEYS.AUTH_TOKEN);
  if (!token) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');

  if (!token) throw new ApiError('http', 'Sesi login tidak ditemukan. Silakan masuk kembali.', 401);

  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  return readApiResponse<T>(response);
}

export function getSchedules(): Promise<ScheduleItem[]> {
  return request<ScheduleItem[]>('/schedules');
}

export function createSchedule(input: ScheduleInput): Promise<ScheduleItem> {
  return request<ScheduleItem>('/schedules', { method: 'POST', body: JSON.stringify(input) });
}

export function updateSchedule(id: string, input: ScheduleInput): Promise<ScheduleItem> {
  return request<ScheduleItem>(`/schedules/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function removeSchedule(id: string): Promise<void> {
  return request<void>(`/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
