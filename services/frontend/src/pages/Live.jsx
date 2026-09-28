import React, { useEffect, useMemo, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import {
  WS_BASE,
  getMe,
  updateInterest,
  createConversation,
  getMessages,
  listConversations,
  markConversationRead,
  listNotifications,
  markAllNotificationsRead,
  presenceHeartbeat,
  fetchNearby,
  setLive,
  fetchPostsFeed,
  fetchVibes,
  getUserProfile,
} from "../api";
import { FALLBACK_VIBES, buildVibeIndex, vibeEmoji } from "../vibes";
import MapView from "../components/MapView";
import PostComposer from "../components/PostComposer";
import PostFeed from "../components/PostFeed";
import ChatWindow from "../components/ChatWindow";
import ProfileEdit from "./ProfileEdit";
import UserProfile from "../components/UserProfile";

export default function Live({ auth }) {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [view, setView] = useState("map"); // "map" or "feed"
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [viewingUserId, setViewingUserId] = useState(null);

  // location + nearby
  const [pos, setPos] = useState(null);
  const [geoErr, setGeoErr] = useState("");
  const [radiusKm, setRadiusKm] = useState(20);
  const [filterInterest, setFilterInterest] = useState("");

  // Vibe catalog comes from the server (falls back to a local copy until it loads).
  const [vibes, setVibes] = useState(FALLBACK_VIBES);
  const vibeIndex = useMemo(() => buildVibeIndex(vibes), [vibes]);
  const selectableVibes = useMemo(
    () => vibes.filter((v) => v.key !== "General"),
    [vibes]
  );
  const topVibes = useMemo(
    () => selectableVibes.slice(0, 7).map((v) => v.key),
    [selectableVibes]
  );
  const moreVibes = useMemo(
    () => selectableVibes.slice(7).map((v) => v.key),
    [selectableVibes]
  );

  useEffect(() => {
    let alive = true;
    fetchVibes()
      .then((list) => {
        if (alive && Array.isArray(list) && list.length > 0) setVibes(list);
      })
      .catch(() => {
        /* keep fallback vibes */
      });
    return () => {
      alive = false;
    };
  }, []);

  // chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUser, setChatUser] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgDraft, setMsgDraft] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(new Map()); // userId -> unread count
  const [totalUnread, setTotalUnread] = useState(0);
  const [lastMessageNotifs, setLastMessageNotifs] = useState(new Map()); // senderId -> { conversationId, senderName, timestamp }

  // Messenger-style conversation list
  const [showMessagesList, setShowMessagesList] = useState(false);
  const [conversationList, setConversationList] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const messagesListRef = useRef(null);

  // Notifications bell
  const [showNotificationsList, setShowNotificationsList] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const notificationsListRef = useRef(null);
  
  // Pagination and new posts state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const [latestPostId, setLatestPostId] = useState(null);

  const stomp = useMemo(() => {
    const c = new Client({
      webSocketFactory: () => new SockJS(`${WS_BASE}/ws`),
      connectHeaders: { Authorization: `Bearer ${auth.accessToken}` },
      reconnectDelay: 2000,
      debug: (str) => {
        console.log('[WebSocket]', str);
      },
    });
    return c;
  }, [auth.accessToken]);

  // Load me
  useEffect(() => {
    getMe()
      .then((m) => setMe(m))
      .catch(() => {});
  }, []);

  // WebSocket for chat and real-time feed updates
  useEffect(() => {
    // Set up the onConnect handler BEFORE activating
    stomp.onConnect = () => {
      console.log('✅ WebSocket connected successfully');
      setWsConnected(true);
      
      // Subscribe to feed updates
      stomp.subscribe('/topic/feed/new-post', (message) => {
        try {
          const postEvent = JSON.parse(message.body);
          console.log('New post event received:', postEvent);
          setNewPostsAvailable(true);
        } catch (e) {
          console.error('Error parsing post event:', e);
        }
      });
      
      // Subscribe to personal message notifications
      if (auth.userId) {
        stomp.subscribe(`/user/queue/messages`, (message) => {
          try {
            const notification = JSON.parse(message.body);
            console.log('Message notification received:', notification);
            
            // Only show notification if chat is closed or different conversation
            if (!chatOpen || conversationId !== notification.conversationId) {
              setLastMessageNotifs(prev => {
                const next = new Map(prev);
                next.set(notification.senderId, {
                  conversationId: notification.conversationId,
                  senderName: notification.senderName,
                  timestamp: notification.timestamp,
                });
                return next;
              });
              setUnreadMessages(prev => {
                const newMap = new Map(prev);
                const current = newMap.get(notification.senderId) || 0;
                newMap.set(notification.senderId, current + 1);
                return newMap;
              });
              setTotalUnread(prev => prev + 1);
            }
          } catch (e) {
            console.error('Error parsing message notification:', e);
          }
        });

        stomp.subscribe(`/user/queue/notifications`, (message) => {
          try {
            const n = JSON.parse(message.body);
            setNotifications((prev) => {
              const next = [
                {
                  id: n.id,
                  type: n.type,
                  actorId: n.actorId,
                  actorDisplayName: n.actorDisplayName,
                  actorAvatarUrl: n.actorAvatarUrl,
                  postId: n.postId,
                  commentId: n.commentId,
                  conversationId: n.conversationId,
                  preview: n.preview,
                  isRead: false,
                  createdAt: n.createdAt,
                },
                ...(prev || []),
              ];
              return next.slice(0, 30);
            });
            setUnreadNotifications((c) => c + 1);
          } catch (e) {
            console.error('Error parsing notification:', e);
          }
        });
      }
    };
    
    stomp.onDisconnect = () => {
      console.log('❌ WebSocket disconnected');
      setWsConnected(false);
    };
    
    stomp.onStompError = (frame) => {
      console.error('❌ WebSocket STOMP error:', frame);
      setWsConnected(false);
    };
    
    stomp.onWebSocketError = (event) => {
      console.error('❌ WebSocket error:', event);
      setWsConnected(false);
    };
    
    // Now activate the connection
    stomp.activate();
    
    return () => {
      setWsConnected(false);
      stomp.deactivate();
    };
  }, [stomp]);

  // Watch GPS
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoErr("Geolocation not supported");
      // Set default location to India (Delhi) if geolocation not supported
      setPos({ lat: 28.6139, lon: 77.2090 });
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGeoErr("");
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude });
      },
      (e) => {
        console.error("Geolocation error:", e);
        setGeoErr(e?.message || "Location error");
        // Fallback to default location (Delhi, India)
        setPos({ lat: 28.6139, lon: 77.2090 });
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Heartbeat + fetch nearby users and posts
  useEffect(() => {
    if (!pos || !me) return;

    let alive = true;

    const tick = async () => {
      try {
        // Only send heartbeat if user is live
        if (me.live) {
          await presenceHeartbeat(pos.lat, pos.lon, me.displayName, me.interest, true);
        }

        const [usersList] = await Promise.all([
          fetchNearby(pos.lat, pos.lon, radiusKm, 50, filterInterest),
        ]);

        if (alive) {
          setUsers((usersList || []).filter((u) => u.userId !== auth.userId));
        }
      } catch (e) {
        console.error("Failed to fetch nearby:", e);
      }
    };

    tick();
    const id = setInterval(tick, 5000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pos, me, radiusKm, filterInterest, auth.userId]);

  // Initial posts load and filter change
  useEffect(() => {
    if (pos) {
      refreshPosts(true);
    }
  }, [pos, filterInterest]);

  // Check for new posts every 30 seconds
  useEffect(() => {
    if (!latestPostId) return;
    
    const interval = setInterval(() => {
      checkForNewPosts();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [latestPostId, pos, filterInterest]);

  // Subscribe to chat when conversationId changes
  useEffect(() => {
    if (!conversationId || !stomp.connected) return;

    const sub = stomp.subscribe(`/topic/chat/${conversationId}`, (msg) => {
      try {
        const ev = JSON.parse(msg.body);
        setMessages((prev) => [
          ...prev,
          {
            id: ev.messageId || ev.id || `${Date.now()}-${Math.random()}`,
            senderId: ev.senderId,
            content: ev.body || ev.content || "",
            messageType: ev.messageType || "text",
            mediaUrl: ev.mediaUrl,
            sentAt: ev.sentAt || ev.createdAtIso,
          },
        ]);
      } catch (error) {
        console.error('Error parsing chat message:', error);
      }
    });

    return () => sub.unsubscribe();
  }, [conversationId, stomp]);

  const toggleLive = async () => {
    if (!me) return;
    try {
      const next = !me.live;
      await setLive(next);
      setMe((m) => ({ ...m, live: next }));
      if (!next) {
        setUsers([]);
        setPosts([]);
      }
    } catch (e) {
      console.error("Failed to toggle live:", e);
    }
  };

  const openChat = async (user) => {
    try {
      setChatOpen(true);
      setChatUser(user);
      
      // Clear unread count for this user
      setUnreadMessages(prev => {
        const newMap = new Map(prev);
        const count = newMap.get(user.userId) || 0;
        setTotalUnread(total => Math.max(0, total - count));
        newMap.delete(user.userId);
        return newMap;
      });
      setLastMessageNotifs(prev => {
        const next = new Map(prev);
        next.delete(user.userId);
        return next;
      });

      const res = await createConversation(user.userId);
      setConversationId(res.conversationId);

      const history = await getMessages(res.conversationId);
      setMessages(
        history.map((m) => ({
          id: m.messageId || m.id,
          senderId: m.senderId,
          content: m.content || m.body || "",
          messageType: m.messageType || "text",
          mediaUrl: m.mediaUrl,
          sentAt: m.createdAt || m.sentAt || m.createdAtIso,
        }))
      );

      // Mark read server-side (keeps conversation list unread counters accurate)
      try {
        await markConversationRead(res.conversationId);
      } catch (e) {
        // non-fatal
      }
    } catch (e) {
      console.error("Failed to open chat:", e);
    }
  };

  const viewUserProfile = (user) => {
    setViewingUserId(user.userId);
  };

  const refreshConversationList = async () => {
    setLoadingConversations(true);
    try {
      const list = await listConversations();
      setConversationList(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("Failed to load conversations:", e);
      setConversationList([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  const refreshNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const res = await listNotifications(30);
      setUnreadNotifications(res?.unreadCount || 0);
      setNotifications(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      console.error("Failed to load notifications:", e);
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Close messages list on outside click
  useEffect(() => {
    if (!showMessagesList) return;
    const onDoc = (e) => {
      if (!messagesListRef.current) return;
      if (messagesListRef.current.contains(e.target)) return;
      setShowMessagesList(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showMessagesList]);

  // Close notifications list on outside click
  useEffect(() => {
    if (!showNotificationsList) return;
    const onDoc = (e) => {
      if (!notificationsListRef.current) return;
      if (notificationsListRef.current.contains(e.target)) return;
      setShowNotificationsList(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showNotificationsList]);

  const sendMsg = () => {
    const body = msgDraft.trim();
    if (!body || !conversationId) return;
    
    // Check if WebSocket is connected
    if (!wsConnected || !stomp.connected) {
      console.error('WebSocket not connected. Status:', { wsConnected, stompConnected: stomp.connected });
      alert('Chat is connecting. Please wait a moment and try again.\n\nCheck the browser console for connection details.');
      return;
    }
    
    try {
      console.log('Sending message:', { conversationId, body });
      stomp.publish({
        destination: `/app/chat.send/${conversationId}`,
        body: JSON.stringify({ body, messageType: "text" }),
      });
      setMsgDraft("");
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const sendImage = async (file) => {
    if (!conversationId) return;
    
    if (!wsConnected || !stomp.connected) {
      alert('Chat is connecting. Please wait...');
      return;
    }

    try {
      // Convert image to base64 for instant preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        
        // Send immediately with base64 - WhatsApp-style instant delivery
        stomp.publish({
          destination: `/app/chat.send/${conversationId}`,
          body: JSON.stringify({ 
            body: file.name,
            messageType: "image",
            mediaUrl: base64
          }),
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to send image:', error);
      alert('Failed to send image. Please try again.');
    }
  };

  const refreshPosts = async (resetPage = true) => {
    if (!pos) return;
    try {
      if (resetPage) {
        setPage(0);
        setHasMore(true);
      }
      const postsList = await fetchPostsFeed(pos.lat, pos.lon, radiusKm, 20, filterInterest);
      setPosts(postsList || []);
      setHasMore((postsList || []).length === 20);
      if (postsList && postsList.length > 0) {
        setLatestPostId(postsList[0].id);
      }
      setNewPostsAvailable(false);
    } catch (e) {
      console.error("Failed to refresh posts:", e);
    }
  };

  const loadMorePosts = async () => {
    if (!pos || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const morePosts = await fetchPostsFeed(pos.lat, pos.lon, radiusKm, 20, filterInterest, nextPage * 20);
      if (morePosts && morePosts.length > 0) {
        setPosts(prev => [...prev, ...morePosts]);
        setPage(nextPage);
        setHasMore(morePosts.length === 20);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error("Failed to load more posts:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const checkForNewPosts = async () => {
    if (!pos || !latestPostId) return;
    try {
      const latestPosts = await fetchPostsFeed(pos.lat, pos.lon, radiusKm, 1, filterInterest);
      if (latestPosts && latestPosts.length > 0 && latestPosts[0].id !== latestPostId) {
        setNewPostsAvailable(true);
      }
    } catch (e) {
      // Silently fail for background check
    }
  };

  const loadNewPosts = () => {
    refreshPosts(true);
  };

  if (showProfileEdit) {
    return (
      <ProfileEdit 
        auth={auth} 
        onClose={() => {
          setShowProfileEdit(false);
          loadProfile();
        }} 
      />
    );
  }

  const loadProfile = async () => {
    try {
      const data = await getMe();
      setMe(data);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  if (!pos) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ fontSize: "48px" }}>📍</div>
        <div style={{ fontSize: "18px", fontWeight: "600", color: "#374151" }}>
          Requesting location access...
        </div>
        <div style={{ fontSize: "14px", color: "#6b7280" }}>
          {geoErr || "Please allow location permissions to continue"}
        </div>
      </div>
    );
  }

  const headerIconBtn = (active = false, variant = "neutral") => ({
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    border: "none",
    background:
      variant === "brand"
        ? "#667eea"
        : variant === "success"
          ? "#10b981"
          : active
            ? "#667eea"
            : "#f3f4f6",
    color: variant === "neutral" && !active ? "#111827" : "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flex: "0 0 auto",
  });

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f9fafb" }}>
      {/* Header */}
      <div
        style={{
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#667eea", whiteSpace: "nowrap" }}>
            Live Presence
          </div>
          <div style={{ display: "flex", gap: "8px", flex: "0 0 auto" }}>
            <button
              onClick={() => setView("map")}
              style={{
                ...headerIconBtn(view === "map"),
              }}
              title="Map"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M9 3v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M15 6v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => setView("feed")}
              style={{
                ...headerIconBtn(view === "feed"),
              }}
              title="Feed"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M4 6h16v14H4V6z" stroke="currentColor" strokeWidth="2" />
                <path d="M8 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: "0 0 auto" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: "600", fontSize: "14px" }}>{me?.displayName || auth.displayName}</div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              {me?.interest || "General"}
            </div>
          </div>
          <button
            onClick={() => setShowProfileEdit(true)}
            style={{
              ...headerIconBtn(false, "brand"),
              fontWeight: "800",
              fontSize: "15px",
            }}
            title="Edit Profile"
          >
            {(me?.displayName || auth.displayName)?.charAt(0).toUpperCase() || "U"}
            {me?.live && (
              <div style={{
                position: "absolute",
                bottom: "0px",
                right: "0px",
                width: "12px",
                height: "12px",
                background: "#10b981",
                border: "2px solid white",
                borderRadius: "50%",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}></div>
            )}
          </button>
          
          <div ref={messagesListRef} style={{ position: "relative" }}>
            {/* Messages Button with Notification Badge */}
            <button
              onClick={() => {
                setShowMessagesList((v) => {
                  const next = !v;
                  if (!v && next) refreshConversationList();
                  return next;
                });
              }}
              style={{
                ...headerIconBtn(false),
              }}
              title={totalUnread > 0 ? `${totalUnread} unread messages` : "Messages"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              {totalUnread > 0 && (
                <div style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  minWidth: "20px",
                  height: "20px",
                  background: "#ef4444",
                  color: "white",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "0 6px",
                  border: "2px solid white",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}>
                  {totalUnread > 99 ? "99+" : totalUnread}
                </div>
              )}
            </button>

          {/* Messenger-style conversation list */}
            {showMessagesList && (
              <div
                style={{
                  position: "absolute",
                  top: "48px",
                  right: 0,
                  width: "320px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "14px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  zIndex: 1000,
                }}
              >
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", fontWeight: 700 }}>
                Messages
              </div>
              {loadingConversations ? (
                <div style={{ padding: "14px", color: "#6b7280", fontSize: 14 }}>Loading…</div>
              ) : conversationList.length === 0 ? (
                <div style={{ padding: "14px", color: "#6b7280", fontSize: 14 }}>
                  No conversations yet. Open a user on the map to chat.
                </div>
              ) : (
                conversationList.map((c) => {
                  const localUnread = unreadMessages.get(c.otherUserId) || 0;
                  const unread = Math.max(localUnread, c.unreadCount || 0);
                  const time = c.lastMessageAt
                    ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "";

                  return (
                    <button
                      key={c.conversationId}
                      onClick={async () => {
                        setShowMessagesList(false);
                        await openChat({
                          userId: c.otherUserId,
                          displayName: c.otherDisplayName,
                          avatarUrl: c.otherAvatarUrl,
                          live: c.otherLive,
                        });
                      }}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "white",
                        textAlign: "left",
                        padding: "12px 14px",
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        cursor: "pointer",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          position: "relative",
                          flex: "0 0 auto",
                        }}
                      >
                        {(c.otherDisplayName || "U").charAt(0).toUpperCase()}
                        {c.otherLive && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: -1,
                              right: -1,
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: "#10b981",
                              border: "2px solid white",
                            }}
                          />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontWeight: unread > 0 ? 800 : 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.otherDisplayName || "User"}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280", flex: "0 0 auto" }}>{time}</div>
                        </div>
                        <div style={{ fontSize: 13, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.lastMessagePreview || ""}
                        </div>
                      </div>

                      {unread > 0 && (
                        <div
                          style={{
                            minWidth: 22,
                            height: 22,
                            borderRadius: 11,
                            background: "#ef4444",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 800,
                            padding: "0 6px",
                          }}
                        >
                          {unread > 99 ? "99+" : unread}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
              </div>
            )}
          </div>

          <div ref={notificationsListRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                setShowNotificationsList((v) => {
                  const next = !v;
                  if (!v && next) {
                    refreshNotifications();
                    markAllNotificationsRead()
                      .then(() => {
                        setUnreadNotifications(0);
                        setNotifications((prev) => (prev || []).map((x) => ({ ...x, isRead: true })));
                      })
                      .catch(() => {});
                  }
                  return next;
                });
              }}
              style={{
                ...headerIconBtn(false),
              }}
              title={unreadNotifications > 0 ? `${unreadNotifications} new notifications` : "Notifications"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {unreadNotifications > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    minWidth: "20px",
                    height: "20px",
                    background: "#ef4444",
                    color: "white",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "0 6px",
                    border: "2px solid white",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </div>
              )}
            </button>

            {showNotificationsList && (
              <div
                style={{
                  position: "absolute",
                  top: "48px",
                  right: 0,
                  width: "340px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "14px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  zIndex: 1000,
                }}
              >
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", fontWeight: 700 }}>
                  Notifications
                </div>
                {loadingNotifications ? (
                  <div style={{ padding: "14px", color: "#6b7280", fontSize: 14 }}>Loading…</div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: "14px", color: "#6b7280", fontSize: 14 }}>No notifications yet.</div>
                ) : (
                  notifications.map((n) => {
                    const actor = n.actorDisplayName || "Someone";
                    const time = n.createdAt
                      ? new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "";
                    const primary =
                      n.type === "POST_LIKED"
                        ? `${actor} liked your post`
                        : n.type === "POST_REACTED"
                          ? `${actor} reacted to your post`
                          : n.type === "POST_COMMENTED"
                            ? `${actor} commented on your post`
                            : n.type === "MESSAGE_RECEIVED"
                              ? `${actor} sent you a message`
                              : `${actor}`;

                    return (
                      <button
                        key={n.id}
                        onClick={async () => {
                          setShowNotificationsList(false);

                          if (n.type === "MESSAGE_RECEIVED" && n.actorId) {
                            await openChat({
                              userId: n.actorId,
                              displayName: actor,
                              avatarUrl: n.actorAvatarUrl,
                              live: false,
                            });
                          }
                        }}
                        style={{
                          width: "100%",
                          border: "none",
                          background: "white",
                          textAlign: "left",
                          padding: "12px 14px",
                          display: "flex",
                          gap: "10px",
                          alignItems: "flex-start",
                          cursor: "pointer",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            flex: "0 0 auto",
                            marginTop: 2,
                          }}
                        >
                          {actor.charAt(0).toUpperCase()}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <div
                              style={{
                                fontWeight: n.isRead ? 700 : 800,
                                fontSize: 14,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {primary}
                            </div>
                            <div style={{ fontSize: 12, color: "#6b7280", flex: "0 0 auto" }}>{time}</div>
                          </div>
                          {n.preview && (
                            <div
                              style={{
                                fontSize: 13,
                                color: "#6b7280",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {n.preview}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          
          {/* Location Toggle Button */}
          <button
            onClick={toggleLive}
            style={{
              ...headerIconBtn(false, me?.live ? "success" : "neutral"),
            }}
            title={me?.live ? "Turn off location sharing" : "Turn on location sharing"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 21s7-4.35 7-10a7 7 0 0 0-14 0c0 5.65 7 10 7 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Vibe Filter Bar - Modern Style */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 24px",
          display: "flex",
          gap: "16px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Vibe Pills */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flex: 1 }}>
          <button
            onClick={() => setFilterInterest("")}
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: "none",
              background: filterInterest === "" ? "#1a1a1a" : "#f3f4f6",
              color: filterInterest === "" ? "white" : "#6b7280",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ✨ All Vibes
          </button>
          {topVibes.map((interest) => {
            const emoji = vibeEmoji(vibeIndex, interest);

            return (
              <button
                key={interest}
                onClick={() => setFilterInterest(prev => prev === interest ? "" : interest)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: "none",
                  background: filterInterest === interest ? "#667eea" : "#f3f4f6",
                  color: filterInterest === interest ? "white" : "#6b7280",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {emoji} {interest}
              </button>
            );
          })}
          <select
            value={filterInterest}
            onChange={(e) => setFilterInterest(e.target.value)}
            style={{
              padding: "10px 16px",
              borderRadius: "24px",
              border: "1px solid #e5e7eb",
              background: "white",
              color: "#6b7280",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">+ More Vibes</option>
            {moreVibes.map((interest) => (
              <option key={interest} value={interest}>
                {interest}
              </option>
            ))}
          </select>
        </div>

        {/* Radius Control */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "200px" }}>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#6b7280" }}>📍</span>
          <input
            type="range"
            min="1"
            max="20"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            style={{ 
              flex: 1,
              accentColor: "#667eea",
            }}
          />
          <div style={{ 
            fontSize: "13px", 
            fontWeight: "700", 
            color: "#667eea",
            minWidth: "45px",
            textAlign: "right",
          }}>
            {radiusKm} km
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {view === "map" ? (
          <div style={{ flex: 1, padding: "20px" }}>
            <MapView 
              center={pos} 
              users={users} 
              radiusKm={radiusKm} 
              onUserClick={openChat}
              onUserRightClick={viewUserProfile}
              unreadMessages={unreadMessages}
            />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "20px",
              maxWidth: "800px",
              margin: "0 auto",
              width: "100%",
            }}
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.target;
              if (scrollHeight - scrollTop <= clientHeight + 100 && !loadingMore && hasMore) {
                loadMorePosts();
              }
            }}
          >
            {/* New Posts Notification */}
            {newPostsAvailable && (
              <div
                onClick={loadNewPosts}
                style={{
                  position: "sticky",
                  top: "10px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 100,
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "24px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  marginBottom: "16px",
                  width: "fit-content",
                  animation: "slideDown 0.3s ease-out",
                }}
              >
                <span style={{ fontSize: "18px" }}>↑</span>
                New posts available
              </div>
            )}
            
            <PostComposer auth={auth} onPostCreated={() => refreshPosts(true)} userLocation={pos} vibes={vibes} />
            <PostFeed posts={posts} auth={auth} onUpdate={() => refreshPosts(true)} onViewProfile={viewUserProfile} vibes={vibes} />
            
            {/* Loading More Indicator */}
            {loadingMore && (
              <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af" }}>
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
                Loading more posts...
              </div>
            )}
            
            {/* No More Posts */}
            {!hasMore && posts.length > 0 && (
              <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: "14px" }}>
                That's all for now! ✨
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>

      {/* Chat Window */}
      <ChatWindow
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setChatUser(null);
          setConversationId(null);
          setMessages([]);
        }}
        chatUser={chatUser}
        messages={messages}
        msgDraft={msgDraft}
        setMsgDraft={setMsgDraft}
        onSend={sendMsg}
        onSendImage={sendImage}
        auth={auth}
      />

      {/* User Profile Viewer */}
      {viewingUserId && (
        <UserProfile
          userId={viewingUserId}
          onClose={() => setViewingUserId(null)}
          onOpenChat={async () => {
            // Fetch user data if not in current users list
            const user = users.find(u => u.userId === viewingUserId);
            if (user) {
              openChat(user);
            } else {
              // Create a minimal user object for chat
              try {
                const userData = await getUserProfile(viewingUserId);
                openChat({
                  userId: viewingUserId,
                  displayName: userData.displayName || 'User',
                  live: false
                });
              } catch (e) {
                console.error('Failed to open chat:', e);
                alert('Failed to open chat. Please try again.');
              }
            }
          }}
        />
      )}
    </div>
  );
}

