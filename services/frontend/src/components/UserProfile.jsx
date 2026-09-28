import React, { useState, useEffect } from "react";
import { getUserProfile } from "../api";

export default function UserProfile({ userId, onClose, onOpenChat }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getUserProfile(userId);
      setProfile(data);
    } catch (err) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}>
        <div style={{
          background: "white",
          padding: "40px",
          borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
        }}>
          <div style={{ fontSize: "18px", color: "#374151" }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }} onClick={onClose}>
        <div style={{
          background: "white",
          padding: "40px",
          borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          maxWidth: "400px"
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: "18px", color: "#dc2626", marginBottom: "20px" }}>
            {error || "Profile not found"}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              border: "none",
              background: "#667eea",
              color: "white",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isPrivate = !profile.profilePublic;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px",
      overflow: "auto"
    }} onClick={onClose}>
      <div style={{
        background: "white",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        maxWidth: "700px",
        width: "100%",
        maxHeight: "90vh",
        overflow: "auto"
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "30px",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          position: "relative"
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "15px",
              right: "15px",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              color: "white",
              fontSize: "20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ✕
          </button>

          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "15px"
          }}>
            <div style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              background: profile.avatarUrl 
                ? `url(${profile.avatarUrl}) center/cover`
                : "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#667eea",
              fontSize: "42px",
              fontWeight: "700",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              border: "4px solid white",
              position: "relative"
            }}>
              {!profile.avatarUrl && profile.displayName?.charAt(0).toUpperCase()}
              {profile.isLive && (
                <div style={{
                  position: "absolute",
                  bottom: "2px",
                  right: "2px",
                  width: "20px",
                  height: "20px",
                  background: "#10b981",
                  border: "3px solid white",
                  borderRadius: "50%",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                }}></div>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              <h2 style={{
                color: "white",
                fontSize: "24px",
                fontWeight: "700",
                margin: "0 0 8px 0"
              }}>
                {profile.displayName}
              </h2>
              {profile.interest && (
                <div style={{
                  display: "inline-block",
                  background: "rgba(255,255,255,0.25)",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "white"
                }}>
                  {profile.interest}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "30px" }}>
          {/* Action Buttons */}
          <div style={{
            display: "flex",
            gap: "12px",
            marginBottom: "30px"
          }}>
            <button
              onClick={async () => {
                await onOpenChat();
                onClose();
              }}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              💬 Message
            </button>
            {profile.isLive && (
              <div style={{
                padding: "12px 20px",
                borderRadius: "12px",
                background: "#d1fae5",
                color: "#065f46",
                fontWeight: "600",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                🟢 Live Now
              </div>
            )}
          </div>

          {isPrivate ? (
            /* Private Profile */
            <div style={{
              textAlign: "center",
              padding: "40px 20px",
              background: "#f9fafb",
              borderRadius: "12px"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
              <div style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "8px"
              }}>
                This profile is private
              </div>
              <div style={{
                fontSize: "14px",
                color: "#6b7280"
              }}>
                {profile.displayName} hasn't made their profile public yet
              </div>
            </div>
          ) : (
            /* Public Profile */
            <>
              {/* Bio */}
              {profile.bio && (
                <div style={{ marginBottom: "30px" }}>
                  <h3 style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#374151",
                    marginBottom: "12px"
                  }}>
                    About
                  </h3>
                  <p style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    lineHeight: "1.6",
                    margin: 0,
                    whiteSpace: "pre-wrap"
                  }}>
                    {profile.bio}
                  </p>
                </div>
              )}

              {/* Gender */}
              {profile.gender && (
                <div style={{ marginBottom: "30px" }}>
                  <div style={{
                    fontSize: "14px",
                    color: "#6b7280"
                  }}>
                    <strong style={{ color: "#374151" }}>Gender:</strong> {profile.gender}
                  </div>
                </div>
              )}

              {/* Posts */}
              <div>
                <h3 style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#374151",
                  marginBottom: "16px"
                }}>
                  Posts ({profile.posts?.length || 0})
                </h3>
                
                {profile.posts && profile.posts.length > 0 ? (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px"
                  }}>
                    {profile.posts.map((post) => (
                      <div key={post.id} style={{
                        padding: "16px",
                        background: "#f9fafb",
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb"
                      }}>
                        <div style={{
                          fontSize: "14px",
                          color: "#374151",
                          marginBottom: "8px",
                          lineHeight: "1.5"
                        }}>
                          {post.content}
                        </div>
                        {post.interest && (
                          <span style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            background: "#e0e7ff",
                            color: "#667eea",
                            fontSize: "11px",
                            fontWeight: "600",
                            marginBottom: "8px"
                          }}>
                            {post.interest}
                          </span>
                        )}
                        <div style={{
                          display: "flex",
                          gap: "16px",
                          fontSize: "12px",
                          color: "#6b7280"
                        }}>
                          <span>❤️ {post.likesCount}</span>
                          <span>💬 {post.commentsCount}</span>
                          <span>📅 {new Date(post.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    background: "#f9fafb",
                    borderRadius: "12px",
                    color: "#6b7280",
                    fontSize: "14px"
                  }}>
                    No posts yet
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
