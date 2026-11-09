export type ApiErrorKind = 'offline' | 'network' | 'timeout' | 'http' | 'invalid-response';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 12_000;

function browserIsOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError('timeout', `Server terlalu lama merespons (batas ${REQUEST_TIMEOUT_MS / 1000} detik).`);
    }
    if (browserIsOffline()) {
      throw new ApiError('offline', 'Tidak ada koneksi internet. Sambungkan internet lalu coba lagi.');
    }
    throw new ApiError('network', 'Tidak dapat terhubung ke server. Periksa internet, alamat API, dan status server.');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const rawBody = await response.text();
  let payload: unknown;

  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      if (response.ok) {
        throw new ApiError('invalid-response', 'Respons server tidak berformat JSON yang valid.', response.status);
      }
    }
  }

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : undefined;
    throw new ApiError('http', message ?? `Permintaan gagal (HTTP ${response.status}).`, response.status);
  }

  if (response.status === 204) return undefined as T;
  if (payload === undefined) {
    throw new ApiError('invalid-response', 'Server berhasil merespons tetapi tidak mengirim data.', response.status);
  }
  return payload as T;
}

export function getApiErrorMessage(error: unknown, subject = 'data'): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : `Gagal memuat ${subject}. Coba lagi.`;
  }

  if (error.kind === 'offline') return error.message;
  if (error.kind === 'network') return `Tidak dapat menghubungi server untuk memuat ${subject}. Periksa koneksi internet atau server.`;
  if (error.kind === 'timeout') return `${error.message} Coba lagi.`;
  if (error.kind === 'invalid-response') return `Data ${subject} dari server tidak dapat dibaca. Coba lagi.`;
  if (error.status === 401) return 'Sesi tidak berlaku. Silakan masuk kembali.';
  if (error.status && error.status >= 500) return `Server sedang bermasalah (HTTP ${error.status}). Coba lagi beberapa saat.`;
  return error.message;
}
