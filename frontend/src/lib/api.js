import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("ielts_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response && err.response.status === 401) {
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/signup" && path !== "/") {
        localStorage.removeItem("ielts_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
