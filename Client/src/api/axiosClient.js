const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request(method, path, body, config = {}) {
  const headers = new Headers(config.headers || {});
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    method,
    headers,
    credentials: 'include',
    signal: config.signal,
    body: body === undefined ? undefined : (body instanceof FormData ? body : JSON.stringify(body))
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (response.status === 401) {
    window.dispatchEvent(new Event('auth-unauthorized'));
  }

  if (!response.ok) {
    const error = new Error(data?.message || `Request failed with status ${response.status}`);
    error.response = { status: response.status, data, headers: response.headers };
    throw error;
  }

  return { data, status: response.status, headers: response.headers };
}

const axiosClient = {
  get: (path, config) => request('GET', path, undefined, config),
  post: (path, body, config) => request('POST', path, body, config),
  put: (path, body, config) => request('PUT', path, body, config),
  patch: (path, body, config) => request('PATCH', path, body, config),
  delete: (path, config) => request('DELETE', path, undefined, config)
};

export default axiosClient;