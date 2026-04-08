const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
export const WS_BASE = import.meta.env.VITE_WS_BASE_URL || API_BASE.replace(/\/api\/?$/, "").replace(/^http/, "ws");

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string" ? payload : payload.message || `Request failed: ${path}`;
    throw new Error(message);
  }

  return payload;
}

export const apiGet = (path, token) => request(path, { token });
export const apiPost = (path, body, token) => request(path, { method: "POST", body, token });
export const apiPut = (path, body, token) => request(path, { method: "PUT", body, token });
export const apiDelete = (path, token) => request(path, { method: "DELETE", token });

export async function apiUpload(path, file, token) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || `Upload failed: ${path}`);
  return payload;
}
