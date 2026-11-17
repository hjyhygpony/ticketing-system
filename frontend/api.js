import { API_BASE, state } from "./state.js";
import { syncAuthButton } from "./render.js";

export async function request(path, options) {
  const requestOptions = options || {};
  const headers = Object.assign({ "Content-Type": "application/json" }, requestOptions.headers || {});

  if (state.token) {
    headers.Authorization = "Bearer " + state.token;
  }

  const response = await fetch(API_BASE + path, Object.assign({}, requestOptions, { headers: headers }));
  const payload = await response.json();

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || payload.detail || "请求失败");
  }

  return payload.data;
}

export function setToken(token) {
  state.token = token || "";
  if (state.token) {
    localStorage.setItem("ticket_token", state.token);
  } else {
    localStorage.removeItem("ticket_token");
  }

  syncAuthButton();
}
