import React, { useMemo, useState } from "react";
import { createPost } from "../api";
import { FALLBACK_VIBES } from "../vibes";

export default function PostComposer({ auth, onPostCreated, userLocation, vibes }) {
  const catalog = useMemo(
    () => (Array.isArray(vibes) && vibes.length > 0 ? vibes : FALLBACK_VIBES),
    [vibes]
  );
  const [content, setContent] = useState("");
  const [selectedVibe, setSelectedVibe] = useState("General");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!content.trim()) return;

    setPosting(true);
    try {
      const post = await createPost({
        content: content.trim(),
        interest: selectedVibe || "General",
        lat: userLocation?.lat || 0,
        lon: userLocation?.lon || 0,
        imageUrl: null
      });
      setContent("");
      setSelectedVibe("General");
      if (onPostCreated) onPostCreated(post);
    } catch (err) {
      console.error("Failed to create post:", err);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        marginBottom: "20px",
      }}
    >
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "700",
            fontSize: "18px",
            flexShrink: 0,
          }}
        >
          {auth.displayName?.charAt(0).toUpperCase() || "U"}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          style={{
            flex: 1,
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "12px",
            fontSize: "15px",
            resize: "none",
            minHeight: "80px",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "#6b7280", marginBottom: "8px" }}>
          Pick a vibe
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {catalog.map((vibe) => {
            const active = selectedVibe === vibe.key;
            return (
              <button
                key={vibe.key}
                onClick={() => setSelectedVibe(vibe.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: active ? "1px solid transparent" : "1px solid #e5e7eb",
                  background: active ? vibe.color : "white",
                  color: active ? "white" : "#374151",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>{vibe.emoji}</span>
                {vibe.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handlePost}
          disabled={posting || !content.trim()}
          style={{
            padding: "10px 24px",
            borderRadius: "10px",
            border: "none",
            background: posting || !content.trim() ? "#e5e7eb" : "#667eea",
            color: "white",
            fontWeight: "600",
            cursor: posting || !content.trim() ? "not-allowed" : "pointer",
            fontSize: "15px",
          }}
        >
          {posting ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}
