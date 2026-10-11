import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Pretty vector basemap. If a MapTiler key is provided we use its premium
// styles; otherwise we fall back to OpenFreeMap's free "Liberty" vector style
// (no API key, GPU-rendered) so the map still looks modern out of the box.
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : "https://tiles.openfreemap.org/styles/liberty";

// One-time stylesheet for the custom markers + popup chrome.
const STYLE_ID = "lp-map-styles";
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    .lp-marker { position: relative; width: 56px; height: 68px; cursor: pointer; }
    .lp-pin {
      position: absolute; left: 50%; top: 4px; width: 46px; height: 46px;
      transform: translateX(-50%) rotate(45deg);
      background: #fff; border: 3px solid #667eea; border-radius: 50% 50% 50% 0;
      box-shadow: 0 6px 16px rgba(0,0,0,.28); transition: transform .18s ease;
    }
    .lp-marker:hover .lp-pin { transform: translateX(-50%) rotate(45deg) scale(1.08); }
    .lp-ava {
      position: absolute; top: 50%; left: 50%; width: 34px; height: 34px;
      transform: translate(-50%,-50%) rotate(-45deg); border-radius: 50%;
      object-fit: cover; background: #eef; border: 2px solid #fff;
    }
    .lp-pulse {
      position: absolute; left: 50%; top: 46px; width: 14px; height: 14px;
      transform: translateX(-50%); border-radius: 50%; background: #10b981;
      box-shadow: 0 0 0 rgba(16,185,129,.6); animation: lp-pulse 1.8s infinite;
    }
    @keyframes lp-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(16,185,129,.55); }
      70%  { box-shadow: 0 0 0 14px rgba(16,185,129,0); }
      100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
    }
    .lp-unread {
      position: absolute; left: 50%; top: 0; transform: translateX(6px);
      min-width: 18px; height: 18px; padding: 0 5px; background: #ef4444; color: #fff;
      border-radius: 9px; border: 2px solid #fff; font-size: 11px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    .maplibregl-popup.lp-pop .maplibregl-popup-content {
      border-radius: 16px; padding: 16px 14px; box-shadow: 0 12px 30px rgba(0,0,0,.18);
      min-width: 190px; text-align: center;
    }
    .lp-pop-name { font-weight: 800; font-size: 17px; color: #1f2937; margin: 8px 0 6px; }
    .lp-pop-vibe {
      display: inline-block; color: #fff; font-size: 12px; font-weight: 700;
      padding: 4px 12px; border-radius: 12px; margin-bottom: 8px;
      background: linear-gradient(135deg,#667eea,#764ba2);
    }
    .lp-pop-dist { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 10px; }
    .lp-pop-actions { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid #eef0f3; }
    .lp-btn {
      flex: 1; padding: 9px 12px; border-radius: 9px; font-weight: 700; font-size: 13px;
      cursor: pointer; border: none; transition: transform .15s ease;
    }
    .lp-btn:hover { transform: scale(1.04); }
    .lp-btn-chat { background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; }
    .lp-btn-prof { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
  `;
  document.head.appendChild(s);
}

function avatarFor(user) {
  return (
    user.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=667eea&color=fff&size=96&bold=true`
  );
}

// Build a geodesic circle polygon (GeoJSON) around a center for the radius ring.
function circleFeature(lng, lat, radiusKm, points = 72) {
  const coords = [];
  const earth = 6371;
  const latR = (radiusKm / earth) * (180 / Math.PI);
  const lngR = latR / Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 2 * Math.PI;
    coords.push([lng + lngR * Math.cos(t), lat + latR * Math.sin(t)]);
  }
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} }],
  };
}

export default function MapView({ center, users, radiusKm, onUserClick, onUserRightClick, unreadMessages }) {
  const mapRef = useRef(null);
  const map = useRef(null);
  const markers = useRef(new Map()); // userId -> maplibregl.Marker
  const ready = useRef(false);

  // Keep latest callbacks/data without re-initialising the map.
  const cbs = useRef({ onUserClick, onUserRightClick });
  cbs.current = { onUserClick, onUserRightClick };
  const data = useRef({ users, unreadMessages });
  data.current = { users, unreadMessages };

  function renderMarkers() {
    if (!map.current || !ready.current) return;
    const { users: us, unreadMessages: unread } = data.current;
    const live = (us || []).filter((u) => (u.live || u.isLive) && u.lastLat != null && u.lastLon != null);
    const seen = new Set();

    live.forEach((user) => {
      seen.add(user.userId);
      const existing = markers.current.get(user.userId);
      if (existing) {
        existing.setLngLat([user.lastLon, user.lastLat]);
        return;
      }
      const unreadCount = unread?.get(user.userId) || 0;

      const el = document.createElement("div");
      el.className = "lp-marker";
      el.innerHTML = `
        <div class="lp-pulse"></div>
        <div class="lp-pin"><img class="lp-ava" src="${avatarFor(user)}"
          onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=667eea&color=fff&size=96&bold=true'"/></div>
        ${unreadCount > 0 ? `<div class="lp-unread">${unreadCount > 99 ? "99+" : unreadCount}</div>` : ""}`;

      const pop = document.createElement("div");
      const dist = user.distanceValue != null ? `${user.distanceValue.toFixed(1)} km away` : "Nearby";
      pop.innerHTML = `
        <div class="lp-pop-name">${user.displayName || "User"}</div>
        <div class="lp-pop-vibe">${user.interest || "General"}</div>
        <div class="lp-pop-dist">📍 ${dist}</div>
        <div class="lp-pop-actions"></div>`;
      const actions = pop.querySelector(".lp-pop-actions");
      const chatBtn = document.createElement("button");
      chatBtn.className = "lp-btn lp-btn-chat";
      chatBtn.textContent = "💬 Chat";
      chatBtn.onclick = () => cbs.current.onUserClick && cbs.current.onUserClick(user);
      const profBtn = document.createElement("button");
      profBtn.className = "lp-btn lp-btn-prof";
      profBtn.textContent = "👤 Profile";
      profBtn.onclick = () => cbs.current.onUserRightClick && cbs.current.onUserRightClick(user);
      actions.appendChild(chatBtn);
      actions.appendChild(profBtn);

      const popup = new maplibregl.Popup({ offset: 30, closeButton: true, className: "lp-pop" }).setDOMContent(pop);
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([user.lastLon, user.lastLat])
        .setPopup(popup)
        .addTo(map.current);

      let closeTimer = null;
      const cancel = () => { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } };
      const schedule = () => { cancel(); closeTimer = setTimeout(() => popup.remove(), 280); };
      el.addEventListener("mouseenter", () => { cancel(); if (!popup.isOpen()) marker.togglePopup(); });
      el.addEventListener("mouseleave", schedule);
      popup.on("open", () => {
        const pe = popup.getElement();
        if (!pe) return;
        pe.addEventListener("mouseenter", cancel);
        pe.addEventListener("mouseleave", schedule);
      });

      markers.current.set(user.userId, marker);
    });

    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }

  // ---- init ----
  useEffect(() => {
    if (!mapRef.current || map.current) return;
    ensureStyles();
    const startLng = center?.lon ?? 77.209;
    const startLat = center?.lat ?? 28.6139;

    const m = new maplibregl.Map({
      container: mapRef.current,
      style: STYLE_URL,
      center: [startLng, startLat],
      zoom: 12,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    m.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-left");

    m.on("load", () => {
      ready.current = true;
      m.addSource("radius", { type: "geojson", data: circleFeature(startLng, startLat, radiusKm || 20) });
      m.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#667eea", "fill-opacity": 0.07 } });
      m.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: { "line-color": "#667eea", "line-width": 1.5, "line-opacity": 0.5, "line-dasharray": [2, 2] },
      });
      renderMarkers();
    });

    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- recentre + radius ring ----
  useEffect(() => {
    if (!map.current || !ready.current || !center) return;
    map.current.easeTo({ center: [center.lon, center.lat], duration: 500 });
    const src = map.current.getSource("radius");
    if (src) src.setData(circleFeature(center.lon, center.lat, radiusKm || 20));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, radiusKm]);

  // ---- markers (diffed by userId) ----
  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, unreadMessages]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "100%", borderRadius: "12px", overflow: "hidden" }}
    />
  );
}
