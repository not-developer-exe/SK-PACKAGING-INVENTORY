const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function buildUrl(path, params) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, String(item)));
    else query.set(key, String(value));
  });

  const serialized = query.toString();
  if (!serialized) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${serialized}`;
}

async function request(method, path, body, config = {}) {
  const headers = new Headers(config.headers || {});
  if (body !== undefined && !isFormData(body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path, config.params), {
    method,
    headers,
    credentials: config.withCredentials === false ? 'same-origin' : 'include',
    signal: config.signal,
    body: body === undefined ? undefined : (isFormData(body) ? body : JSON.stringify(body))
  });

  let data = null;
  if (response.status !== 204) {
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
  }

  if (response.status === 401) {
    window.dispatchEvent(new Event('auth-unauthorized'));
  }

  if (!response.ok) {
    const message = data && typeof data === 'object' && data.message
      ? data.message
      : `Request failed with status ${response.status}`;
    const error = new Error(message);
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
