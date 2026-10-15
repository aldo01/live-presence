import React, { useMemo, useRef, useState } from "react";
import { createPost, uploadMedia } from "../api";
import { FALLBACK_VIBES } from "../vibes";

export default function PostComposer({ auth, avatarUrl, onPostCreated, userLocation, vibes }) {
  const catalog = useMemo(
    () => (Array.isArray(vibes) && vibes.length > 0 ? vibes : FALLBACK_VIBES),
    [vibes]
  );
  const [content, setContent] = useState("");
  const [selectedVibe, setSelectedVibe] = useState("General");
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileRef = useRef(null);

  const pickImage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Please choose an image.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert("Image too large (max 10 MB).");
      return;
    }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePost = async () => {
    if (!content.trim() && !imageFile) return;

    setPosting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        // Upload to encrypted object storage; store the optimized display key.
        const media = await uploadMedia(imageFile, "post");
        imageUrl = media.displayKey;
      }
      const post = await createPost({
        content: content.trim(),
        interest: selectedVibe || "General",
        lat: userLocation?.lat || 0,
        lon: userLocation?.lon || 0,
        imageUrl,
      });
      setContent("");
      setSelectedVibe("General");
      clearImage();
      if (onPostCreated) onPostCreated(post);
    } catch (err) {
      console.error("Failed to create post:", err);
      alert(`Failed to post: ${err.message || err}`);
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
            background: avatarUrl
              ? `url(${avatarUrl}) center/cover`
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "700",
            fontSize: "18px",
            flexShrink: 0,
          }}
        >
          {!avatarUrl && (auth.displayName?.charAt(0).toUpperCase() || "U")}
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

      {imagePreview && (
        <div style={{ position: "relative", marginBottom: "12px", display: "inline-block" }}>
          <img
            src={imagePreview}
            alt="preview"
            style={{ maxHeight: "160px", borderRadius: "12px", display: "block" }}
          />
          <button
            onClick={clearImage}
            style={{
              position: "absolute", top: "6px", right: "6px", width: "26px", height: "26px",
              borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "white",
              cursor: "pointer", fontSize: "14px", lineHeight: "1",
            }}
            title="Remove image"
          >
            ×
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: "none" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            padding: "8px 14px", borderRadius: "10px", border: "1px solid #e5e7eb",
            background: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontSize: "14px",
          }}
          title="Add a photo (up to 10 MB)"
        >
          📷 Photo
        </button>
        <button
          onClick={handlePost}
          disabled={posting || (!content.trim() && !imageFile)}
          style={{
            padding: "10px 24px",
            borderRadius: "10px",
            border: "none",
            background: posting || (!content.trim() && !imageFile) ? "#e5e7eb" : "#667eea",
            color: "white",
            fontWeight: "600",
            cursor: posting || (!content.trim() && !imageFile) ? "not-allowed" : "pointer",
            fontSize: "15px",
          }}
        >
          {posting ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}
