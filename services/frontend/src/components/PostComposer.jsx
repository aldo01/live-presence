import React, { useState } from "react";
import { createPost } from "../api";

const INTERESTS = ["General", "Sports", "Music", "Food", "Tech", "Art", "Travel", "Gaming"];

export default function PostComposer({ auth, onPostCreated, userLocation }) {
  const [content, setContent] = useState("");
  const [selectedInterests, setSelectedInterests] = useState(["General"]);
  const [posting, setPosting] = useState(false);

  const toggleInterest = (interest) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handlePost = async () => {
    if (!content.trim()) return;

    setPosting(true);
    try {
      const post = await createPost({
        content: content.trim(),
        interest: selectedInterests[0] || "General", // Use first selected interest
        lat: userLocation?.lat || 0,
        lon: userLocation?.lon || 0,
        imageUrl: null
      });
      setContent("");
      setSelectedInterests(["General"]);
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
          Interests
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {INTERESTS.map((interest) => (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: "1px solid #e5e7eb",
                background: selectedInterests.includes(interest) ? "#667eea" : "white",
                color: selectedInterests.includes(interest) ? "white" : "#374151",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {interest}
            </button>
          ))}
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
