/** Cliente HTTP enxuto para a API. Token de sessão guardado em localStorage. */

const TOKEN_KEY = 'edugestao_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    setToken(null);
    window.location.href = '/login';
    throw new Error('Sessão expirada.');
  }
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error ?? `Erro ${res.status}`);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
};
