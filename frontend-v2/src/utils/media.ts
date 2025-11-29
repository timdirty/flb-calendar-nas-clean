const LOCAL_FALLBACK_BASE_URL = 'http://localhost:3000/api';

let resolvedBaseURL = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!resolvedBaseURL) {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      resolvedBaseURL = LOCAL_FALLBACK_BASE_URL;
    } else {
      resolvedBaseURL = `${origin}/api`;
    }
  } else {
    resolvedBaseURL = LOCAL_FALLBACK_BASE_URL;
  }
}

const apiOrigin = resolvedBaseURL.replace(/\/api\/?$/, '');

/**
 * 將後端回傳的相對路徑轉成完整 URL
 */
export function resolveMediaUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiOrigin}${normalizedPath}`;
}
