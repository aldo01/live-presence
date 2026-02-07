import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue in webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function MapView({ center, users, radiusKm, onUserClick, onUserRightClick, unreadMessages }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const circleRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      zoomControl: true,
    }).setView([center.lat, center.lon], 13);

    // Use a better map tile style (CartoDB Positron - lighter, more modern)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(mapInstance.current);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update center and radius circle
  useEffect(() => {
    if (!mapInstance.current || !center) return;

    mapInstance.current.setView([center.lat, center.lon], mapInstance.current.getZoom());

    // Remove old circle
    if (circleRef.current) {
      circleRef.current.remove();
    }

    // Add subtle radius circle (optional - can be removed for cleaner look)
    // Uncomment below to show radius circle
    /*
    circleRef.current = L.circle([center.lat, center.lon], {
      radius: radiusKm * 1000,
      color: "#667eea",
      fillColor: "#667eea",
      fillOpacity: 0.03,
      weight: 1,
      opacity: 0.2,
      dashArray: "5, 10",
    }).addTo(mapInstance.current);
    */
  }, [center, radiusKm]);

  // Update user markers
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filter to show only LIVE users
    const liveUsers = users.filter(user => user.live || user.isLive);

    // Add new markers
    liveUsers.forEach((user) => {
      const isLive = true; // Already filtered for live users
      
      // Create custom icon with avatar image or fallback
      const avatarUrl = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=667eea&color=fff&size=96&bold=true`;
      const unreadCount = unreadMessages?.get(user.userId) || 0;
      
      const iconHtml = `
        <div class="user-marker" style="position: relative; width: 64px; height: 64px; cursor: pointer;">
          <div style="
            width: 64px;
            height: 64px;
            border-radius: 50%;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
            border: 4px solid white;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: white;
          ">
            <img 
              src="${avatarUrl}" 
              style="width: 100%; height: 100%; object-fit: cover;"
              onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random&size=128&bold=true';"
            />
          </div>
          ${isLive ? `
            <div class="live-indicator" style="
              position: absolute;
              bottom: 2px;
              right: 2px;
              width: 20px;
              height: 20px;
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(16, 185, 129, 0.6);
            "></div>
          ` : ""}
          ${unreadCount > 0 ? `
            <div class="unread-badge" style="
              position: absolute;
              top: -4px;
              right: -4px;
              min-width: 20px;
              height: 20px;
              background: #ef4444;
              color: white;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 700;
              padding: 0 6px;
              border: 2px solid white;
              box-shadow: 0 2px 8px rgba(239, 68, 68, 0.6);
              animation: pulse 2s infinite;
            ">${unreadCount > 99 ? '99+' : unreadCount}</div>
          ` : ""}
        </div>
        <style>
          .user-marker:hover > div:first-child {
            transform: scale(1.1);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          }
          @keyframes pulse {
            0%, 100% { 
              box-shadow: 0 2px 8px rgba(16, 185, 129, 0.6);
            }
            50% { 
              box-shadow: 0 2px 16px rgba(16, 185, 129, 1);
            }
          }
          .live-indicator {
            animation: pulse 2s infinite ease-in-out;
          }
        </style>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: "custom-marker",
        iconSize: [64, 64],
        iconAnchor: [32, 32],
      });

      const marker = L.marker([user.lastLat, user.lastLon], { icon })
        .addTo(mapInstance.current)
        .bindPopup(`
          <div style="text-align: center; min-width: 180px; padding: 16px 12px;">
            <div style="margin-bottom: 12px;">
              <img 
                src="${avatarUrl}" 
                style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; box-shadow: 0 4px 8px rgba(0,0,0,0.15); border: 3px solid white;"
                onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=667eea&color=fff&size=120&bold=true';"
              />
            </div>
            <div style="font-weight: 700; font-size: 18px; margin-bottom: 8px; color: #1f2937;">
              ${user.displayName}
            </div>
            <div style="
              color: white;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              font-size: 12px;
              padding: 5px 12px;
              border-radius: 12px;
              display: inline-block;
              margin-bottom: 10px;
              font-weight: 600;
            ">
              ${user.interest || "General"}
            </div>
            ${isLive ? '<div style="color: #10b981; font-size: 13px; font-weight: 600; margin-bottom: 10px;">🟢 Live Now</div>' : ""}
            <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
              <button onclick="window.chatUser_${user.userId.replace(/-/g, '')}" style="
                flex: 1;
                padding: 10px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
              " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 8px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(102, 126, 234, 0.3)'">💬 Chat</button>
              <button onclick="window.viewProfile_${user.userId.replace(/-/g, '')}" style="
                flex: 1;
                padding: 10px 16px;
                background: #f3f4f6;
                color: #374151;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
              " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">👤 Profile</button>
            </div>
          </div>
        `)
        .bindTooltip(`
          <div style="text-align: center; min-width: 120px; padding: 8px;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #1f2937;">
              ${user.displayName}
            </div>
            <div style="font-size: 12px; color: #667eea; margin-bottom: 6px; font-weight: 600;">
              ${user.interest || "General"}
            </div>
            <div style="
              font-size: 11px; 
              color: #10b981; 
              background: rgba(16, 185, 129, 0.1);
              padding: 4px 10px;
              border-radius: 12px;
              display: inline-block;
              font-weight: 600;
            ">
              📍 ${user.distanceValue ? user.distanceValue.toFixed(1) + ' km away' : 'Nearby'}
            </div>
          </div>
        `, {
          direction: 'top',
          offset: [0, -28],
          opacity: 0.95,
          className: 'custom-tooltip'
        });

      // Store callbacks in window for popup buttons
      const chatKey = `chatUser_${user.userId.replace(/-/g, '')}`;
      const profileKey = `viewProfile_${user.userId.replace(/-/g, '')}`;
      
      window[chatKey] = () => {
        console.log('Chat button clicked for user:', user.displayName);
        if (onUserClick) onUserClick(user);
      };
      
      window[profileKey] = () => {
        console.log('Profile button clicked for user:', user.displayName);
        if (onUserRightClick) onUserRightClick(user);
      };

      marker.on("click", () => {
        // Popup buttons will handle the actions
      });

      markersRef.current.push(marker);
    });
  }, [users, onUserClick, onUserRightClick]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    />
  );
}
