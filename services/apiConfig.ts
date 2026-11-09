const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!__DEV__ && (!configuredApiUrl || !configuredApiUrl.startsWith('https://'))) {
  throw new Error('Build produksi memerlukan EXPO_PUBLIC_API_URL dengan HTTPS.');
}

export const API_BASE_URL = (configuredApiUrl ?? 'http://localhost:3001/api').replace(/\/$/, '');
