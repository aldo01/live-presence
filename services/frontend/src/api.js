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

export async function register(email, password, displayName) {
  const res = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function login(email, password) {
  const res = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}



export async function getMe() {
  const res = await request("/api/me");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateInterest(interest) {
  const res = await request("/api/me/interest", {
    method: "PUT",
    body: JSON.stringify({ interest })
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function createConversation(targetUserId) {
  const res = await request("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMessages(conversationId) {
  const res = await request(`/api/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function presenceHeartbeat(lat, lon) {
  const res = await request("/api/presence/heartbeat", {
    method: "POST",
    body: JSON.stringify({ lat, lon })
  });
  if (!res.ok) throw new Error(await res.text());
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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setLive(live) {
  const res = await request("/api/me/live", {
    method: "PUT",
    body: JSON.stringify({ live })
  });
  if (!res.ok) throw new Error(await res.text());
}

// ========== Posts API ==========

export async function createPost(data) {
  const res = await request("/api/posts", {
    method: "POST",
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPost(postId) {
  const res = await request(`/api/posts/${postId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deletePost(postId) {
  const res = await request(`/api/posts/${postId}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function toggleLike(postId) {
  const res = await request(`/api/posts/${postId}/like`, {
    method: "POST"
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function addComment(postId, content) {
  const res = await request(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content })
  });
  if (!res.ok) throw new Error(await res.text());
}

// Reaction APIs
export async function reactToPost(postId, reactionType) {
  const res = await request(`/api/posts/${postId}/react`, {
    method: "POST",
    body: JSON.stringify({ reactionType })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function removeReaction(postId) {
  const res = await request(`/api/posts/${postId}/react`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getReactions(postId) {
  const res = await request(`/api/posts/${postId}/reactions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Profile management
export async function updateProfile(data) {
  const res = await request("/api/me/profile", {
    method: "PUT",
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateAvatar(avatarUrl) {
  const res = await request("/api/me/avatar", {
    method: "PUT",
    body: JSON.stringify({ avatarUrl })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function changePassword(currentPassword, newPassword) {
  const res = await request("/api/me/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getUserProfile(userId) {
  const res = await request(`/api/users/${userId}/profile`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  
  const auth = getAuth();
  const res = await fetch(`${API_BASE}/api/upload/image`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${auth.accessToken}`
    },
    body: formData
  });
  
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // Returns { url: "..." }
}
