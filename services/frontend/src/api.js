import { getAuth, setAuth, clearAuth } from "./authStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
// SockJS expects HTTP/HTTPS, not WS/WSS - it converts internally
export const WS_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function request(path, opts = {}) {
  const auth = getAuth();
  const headers = { ...(opts.headers || {}) };

  if (auth?.accessToken) headers["Authorization"] = `Bearer ${auth.accessToken}`;
  if (!headers["Content-Type"] && opts.body) headers["Content-Type"] = "application/json";

  let res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

  // Access token expired -> refresh once
  if (res.status === 401 && auth?.refreshToken && path !== "/api/auth/refresh") {
    const r = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: auth.refreshToken })
    });

    if (r.ok) {
      const newAuth = await r.json();
      setAuth(newAuth);

      const headers2 = { ...(opts.headers || {}) };
      headers2["Authorization"] = `Bearer ${newAuth.accessToken}`;
      if (!headers2["Content-Type"] && opts.body) headers2["Content-Type"] = "application/json";

      res = await fetch(`${API_BASE}${path}`, { ...opts, headers: headers2 });
    } else {
      clearAuth();
    }
  }

  return res;
}

// Pulls a human-readable message out of an error response. The backend returns
// structured JSON like {"error":"Conflict","message":"email already registered"},
// so prefer the `message`/`error` field and fall back to the raw body text.
async function errorText(res) {
  const body = await res.text();
  try {
    const json = JSON.parse(body);
    return json.message || json.error || body;
  } catch {
    return body || `Request failed (${res.status})`;
  }
}

// Tolerant success-body parser: returns parsed JSON when possible, otherwise the
// raw text (or null for empty bodies). Protects callers from endpoints that reply
// with a bare string / 204 instead of JSON.
async function parseJsonSafe(res) {
  const body = await res.text();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function register(email, password, displayName) {
  const res = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName })
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function login(email, password) {
  const res = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}



export async function getMe() {
  const res = await request("/api/me");
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function updateInterest(interest) {
  const res = await request("/api/me/interest", {
    method: "PUT",
    body: JSON.stringify({ interest })
  });
  if (!res.ok) throw new Error(await errorText(res));
}

export async function createConversation(targetUserId) {
  const res = await request("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function getMessages(conversationId) {
  const res = await request(`/api/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function listConversations() {
  const res = await request(`/api/conversations`);
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function markConversationRead(conversationId) {
  const res = await request(`/api/conversations/${conversationId}/read`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await errorText(res));
}

export async function listNotifications(limit = 30) {
  const p = new URLSearchParams({ limit: String(limit) });
  const res = await request(`/api/notifications?${p.toString()}`);
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function markAllNotificationsRead() {
  const res = await request(`/api/notifications/read`, { method: "POST" });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function presenceHeartbeat(lat, lon, displayName, interest, isLive = true) {
  const res = await request("/api/presence/heartbeat", {
    method: "POST",
    body: JSON.stringify({ lat, lon, displayName, interest, isLive })
  });
  if (!res.ok) throw new Error(await errorText(res));
}

export async function fetchNearby(lat, lon, radiusKm = 10, limit = 50, interest = "") {
  const p = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radiusKm: String(radiusKm),
    limit: String(limit)
  });
  if (interest && interest.trim()) p.set("interest", interest.trim());

  const res = await request(`/api/presence/nearby?${p.toString()}`);
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function setLive(live) {
  const res = await request("/api/me/live", {
    method: "PUT",
    body: JSON.stringify({ live })
  });
  if (!res.ok) throw new Error(await errorText(res));
}

// ========== Vibes API ==========

export async function fetchVibes() {
  const res = await request("/api/vibes");
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

// ========== Posts API ==========

export async function createPost(data) {
  const res = await request("/api/posts", {
    method: "POST",
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function fetchPostsFeed(lat, lon, radiusKm = 10, limit = 50, interest = "", offset = 0) {
  const p = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radiusKm: String(radiusKm),
    limit: String(limit),
    offset: String(offset)
  });
  if (interest && interest.trim()) p.set("interest", interest.trim());

  const res = await request(`/api/posts/feed?${p.toString()}`);
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function getPost(postId) {
  const res = await request(`/api/posts/${postId}`);
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function deletePost(postId) {
  const res = await request(`/api/posts/${postId}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error(await errorText(res));
}

export async function toggleLike(postId) {
  const res = await request(`/api/posts/${postId}/like`, {
    method: "POST"
  });
  if (!res.ok) throw new Error(await errorText(res));
}

export async function addComment(postId, content) {
  const res = await request(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content })
  });
  if (!res.ok) throw new Error(await errorText(res));
}

// Reaction APIs
export async function reactToPost(postId, reactionType) {
  const res = await request(`/api/posts/${postId}/react`, {
    method: "POST",
    body: JSON.stringify({ reactionType })
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function removeReaction(postId) {
  const res = await request(`/api/posts/${postId}/react`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function getReactions(postId) {
  const res = await request(`/api/posts/${postId}/reactions`);
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

// Builds a STABLE public URL for a display-only media object (avatars). Unlike
// the presigned chat/post download URLs, this never expires, so it can be used
// directly in `<img src>` / CSS `url(...)` across the map, chat list, and profile.
export function mediaPublicUrl(key) {
  if (!key) return "";
  // Already a full/external URL (legacy avatars, external hosts) — use as-is.
  if (/^(https?:)?\/\//i.test(key) || key.startsWith("data:")) return key;
  const clean = key.replace(/^\/+/, "");
  return `${API_BASE}/api/media/public/${clean}`;
}

// Profile management
export async function updateProfile(data) {
  const res = await request("/api/me/profile", {
    method: "PUT",
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await errorText(res));
  return parseJsonSafe(res);
}

export async function updateAvatar(avatarUrl) {
  const res = await request("/api/me/avatar", {
    method: "PUT",
    body: JSON.stringify({ avatarUrl })
  });
  if (!res.ok) throw new Error(await errorText(res));
  return parseJsonSafe(res);
}

export async function changePassword(currentPassword, newPassword) {
  const res = await request("/api/me/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword })
  });
  if (!res.ok) throw new Error(await errorText(res));
  return parseJsonSafe(res);
}

export async function getUserProfile(userId) {
  const res = await request(`/api/users/${userId}/profile`);
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

// ========== Media API (presigned direct upload/download) ==========

export async function presignUpload({ filename, contentType, size, scope }) {
  const res = await request("/api/media/presign-upload", {
    method: "POST",
    body: JSON.stringify({ filename, contentType, size, scope }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json(); // { uploadUrl, key, headers, maxBytes, expiresInSeconds }
}

export async function finalizeMedia(key, contentType) {
  const res = await request("/api/media/finalize", {
    method: "POST",
    body: JSON.stringify({ key, contentType }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json(); // { key, displayKey, thumbKey, optimized }
}

export async function getMediaDownloadUrl(key) {
  const res = await request("/api/media/download-url", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json(); // { downloadUrl }
}

// Full upload orchestration: presign -> PUT bytes DIRECTLY to object storage
// (bypassing our app servers) -> finalize (image optimization).
export async function uploadMedia(file, scope = "misc") {
  const contentType = file.type || "application/octet-stream";
  const presign = await presignUpload({
    filename: file.name,
    contentType,
    size: file.size,
    scope,
  });
  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers || { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) throw new Error(`upload failed (${putRes.status})`);
  const fin = await finalizeMedia(presign.key, contentType);
  return {
    key: fin.key,
    displayKey: fin.displayKey || fin.key,
    thumbKey: fin.thumbKey || null,
    optimized: !!fin.optimized,
    contentType,
    filename: file.name,
    size: file.size,
    isImage: contentType.startsWith("image/"),
  };
}

// Backwards-compatible helper (avatars/posts): upload an image, return keys.
export async function uploadImage(file, scope = "post") {
  const m = await uploadMedia(file, scope);
  return { key: m.displayKey, originalKey: m.key, thumbKey: m.thumbKey };
}
