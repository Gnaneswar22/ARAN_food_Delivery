import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_URL || '') + '/api/v1';

export const api = axios.create({ baseURL, withCredentials: true, timeout: 20000 });

let accessToken = null;
let onAuthLost = () => {};
export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

// Single-flight refresh: concurrent 401s share one refresh call.
let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true, headers: { 'X-Requested-With': 'aran' } })
      .then((r) => { accessToken = r.data.data.accessToken; return r.data.data; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = config?.url?.includes('/auth/');
    if (response?.status === 401 && !config._retried && !isAuthCall && accessToken) {
      config._retried = true;
      try { await refreshSession(); return api(config); } catch { accessToken = null; onAuthLost(); }
    }
    return Promise.reject(error);
  }
);

export const errMsg = (e, fallback = 'Something went wrong. Please try again.') => {
  if (!e.response) return 'Network error. Check your connection and try again.';
  return e.response.data?.error?.message || fallback;
};
export const fieldErrors = (e) => {
  const d = e.response?.data?.error?.details;
  return Array.isArray(d) ? Object.fromEntries(d.filter((x) => x.path).map((x) => [x.path, x.message])) : {};
};

// Thin wrappers returning `data` (and meta where useful)
export const get = (url, params) => api.get(url, { params }).then((r) => r.data);
export const post = (url, body, cfg) => api.post(url, body, cfg).then((r) => r.data);
export const put = (url, body) => api.put(url, body).then((r) => r.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);
export const del = (url) => api.delete(url).then((r) => r.data);
