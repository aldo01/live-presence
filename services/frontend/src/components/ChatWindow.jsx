import React, { useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker from "./EmojiPicker";

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
    if (file && file.type.startsWith("image/")) {
      onSendImage(file);
      // Reset file input so same file can be selected again
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
                    <img
                      src={m.mediaUrl || m.content}
                      alt="Sent image"
                      style={{
                        maxWidth: "100%",
                        display: "block",
                        cursor: "pointer",
                      }}
                      onClick={() => window.open(m.mediaUrl || m.content, "_blank")}
                    />
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

          {/* Image Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "8px",
              border: "none",
              background: "transparent",
              fontSize: "20px",
              cursor: "pointer",
              borderRadius: "50%",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#f3f4f6")}
            onMouseLeave={(e) => (e.target.style.background = "transparent")}
            title="Send photo"
          >
            📷
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />

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
