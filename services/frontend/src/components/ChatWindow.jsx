import React, { useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker from "./EmojiPicker";
import { getMediaDownloadUrl } from "../api";

// A legacy base64/data URL or a plain http(s) URL can be used directly; anything
// else is treated as an object-storage key that must be resolved to a presigned
// URL before it can be shown/downloaded.
function isDirectUrl(s) {
  return typeof s === "string" && (s.startsWith("http") || s.startsWith("data:") || s.startsWith("blob:"));
}

export default function ChatWindow({
  isOpen,
  onClose,
  chatUser,
  messages,
  msgDraft,
  setMsgDraft,
  onSend,
  onSendImage,
  auth,
}) {
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mediaUrls, setMediaUrls] = useState({}); // object key -> presigned URL

  // Resolve object-storage keys on media messages into short-lived presigned URLs.
  useEffect(() => {
    const keys = (messages || [])
      .filter((m) => (m.messageType === "image" || m.messageType === "document") && m.mediaUrl && !isDirectUrl(m.mediaUrl))
      .map((m) => m.mediaUrl);
    const missing = [...new Set(keys)].filter((k) => !mediaUrls[k]);
    if (missing.length === 0) return;
    let alive = true;
    missing.forEach(async (key) => {
      try {
        const { downloadUrl } = await getMediaDownloadUrl(key);
        if (alive) setMediaUrls((prev) => ({ ...prev, [key]: downloadUrl }));
      } catch (e) {
        /* leave unresolved; a placeholder shows */
      }
    });
    return () => {
      alive = false;
    };
  }, [messages, mediaUrls]);

  const resolveSrc = (m) => (isDirectUrl(m.mediaUrl) ? m.mediaUrl : mediaUrls[m.mediaUrl]);

  const displayMessages = useMemo(() => {
    const toMs = (v) => {
      if (!v) return 0;
      const ms = Date.parse(v);
      return Number.isFinite(ms) ? ms : 0;
    };

    return [...(messages || [])]
      .map((m, idx) => ({ m, idx }))
      .sort((a, b) => {
        const ta = toMs(a.m.sentAt || a.m.createdAt);
        const tb = toMs(b.m.sentAt || b.m.createdAt);
        if (ta !== tb) return ta - tb; // oldest -> newest
        return a.idx - b.idx;
      })
      .map((x) => x.m);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      onSendImage(file); // handles both images and documents (up to 10 MB)
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleEmojiSelect = (emoji) => {
    setMsgDraft(msgDraft + emoji);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        width: "380px",
        height: "560px",
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "16px 16px 0 0",
          color: "white",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#667eea",
              fontWeight: "700",
              fontSize: "16px",
            }}
          >
            {chatUser?.displayName?.charAt(0).toUpperCase() || "U"}
          </div>
          <div>
            <div style={{ fontWeight: "600", fontSize: "15px" }}>
              {chatUser?.displayName || "User"}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>
              {chatUser?.live ? "🟢 Active now" : "Offline"}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "white",
            fontSize: "20px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {displayMessages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#9ca3af",
              fontSize: "14px",
              marginTop: "40px",
            }}
          >
            No messages yet. Start the conversation!
          </div>
        ) : (
          displayMessages.map((m, idx) => {
            const isMe = m.senderId === auth.userId;
            return (
              <div
                key={m.id || m.messageId || `${m.senderId || "u"}-${m.sentAt || "t"}-${idx}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                }}
              >
                {m.messageType === "image" ? (
                  <div
                    style={{
                      maxWidth: "70%",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      overflow: "hidden",
                      background: isMe
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "#f3f4f6",
                    }}
                  >
                    {resolveSrc(m) ? (
                      <img
                        src={resolveSrc(m)}
                        alt="Sent image"
                        style={{ maxWidth: "100%", display: "block", cursor: "pointer" }}
                        onClick={() => window.open(resolveSrc(m), "_blank")}
                      />
                    ) : (
                      <div style={{ padding: "28px 24px", color: isMe ? "white" : "#6b7280", fontSize: "13px" }}>
                        🖼️ Loading image…
                      </div>
                    )}
                    {m.content && (
                      <div
                        style={{
                          padding: "8px 12px",
                          color: isMe ? "white" : "#1f2937",
                          fontSize: "14px",
                        }}
                      >
                        {m.content}
                      </div>
                    )}
                  </div>
                ) : m.messageType === "document" ? (
                  <a
                    href={resolveSrc(m) || undefined}
                    target="_blank"
                    rel="noreferrer"
                    download={m.content || true}
                    style={{
                      maxWidth: "70%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isMe
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "#f3f4f6",
                      color: isMe ? "white" : "#1f2937",
                      textDecoration: "none",
                      cursor: resolveSrc(m) ? "pointer" : "default",
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>📄</span>
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.content || "Document"}
                      </div>
                      <div style={{ fontSize: "12px", opacity: 0.85 }}>
                        {resolveSrc(m) ? "Tap to open / download" : "Preparing…"}
                      </div>
                    </div>
                  </a>
                ) : (
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "10px 14px",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isMe
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "#f3f4f6",
                      color: isMe ? "white" : "#1f2937",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      wordBreak: "break-word",
                    }}
                  >
                    {m.content}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "11px",
                    color: "#9ca3af",
                    marginTop: "4px",
                    paddingLeft: isMe ? 0 : "4px",
                    paddingRight: isMe ? "4px" : 0,
                  }}
                >
                  {new Date(m.sentAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid #f3f4f6",
          position: "relative",
        }}
      >
        {showEmojiPicker && (
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            style={{
              padding: "8px",
              border: "none",
              background: "transparent",
              fontSize: "24px",
              cursor: "pointer",
              borderRadius: "50%",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#f3f4f6")}
            onMouseLeave={(e) => (e.target.style.background = "transparent")}
            title="Add emoji"
          >
            😊
          </button>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />

          {/* Document/attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "8px",
              border: "none",
              background: "transparent",
              fontSize: "20px",
              cursor: "pointer",
              borderRadius: "50%",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#f3f4f6")}
            onMouseLeave={(e) => (e.target.style.background = "transparent")}
            title="Attach file (image or document, up to 10 MB)"
          >
            📎
          </button>

          <input
            type="text"
            value={msgDraft}
            onChange={(e) => setMsgDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "20px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button
            onClick={onSend}
            disabled={!msgDraft.trim()}
            style={{
              padding: "10px 20px",
              borderRadius: "20px",
              border: "none",
              background: msgDraft.trim()
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "#e5e7eb",
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              cursor: msgDraft.trim() ? "pointer" : "not-allowed",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
