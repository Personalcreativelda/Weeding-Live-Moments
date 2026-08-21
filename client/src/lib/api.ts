// In production the frontend (Vercel) and backend (VPS) live on different origins,
// so VITE_API_URL points at the API's own domain. Locally it's left unset and Vite's
// dev proxy (vite.config.ts) forwards relative /api requests to the backend instead.
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_BASE = `${API_ORIGIN}/api`;

/** Builds an absolute API URL for plain <img>/<a> tags (QR codes, exports) that can't use fetch(). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers:
      init?.body instanceof FormData
        ? undefined
        : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore body parse failure
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
