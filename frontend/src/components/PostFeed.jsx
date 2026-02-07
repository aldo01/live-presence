import React, { useState } from "react";
import { toggleLike, addComment, deletePost, reactToPost, removeReaction, getReactions } from "../api";

// Format counts like 966K, 18.5K, 9.7M
function formatCount(count) {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

const REACTIONS = [
  { type: 'LIKE', emoji: '👍', color: '#1877f2' },
  { type: 'LOVE', emoji: '❤️', color: '#f33e58' },
  { type: 'HAHA', emoji: '😂', color: '#f7b125' },
  { type: 'WOW', emoji: '😮', color: '#f7b125' },
  { type: 'SAD', emoji: '😢', color: '#f7b125' },
  { type: 'ANGRY', emoji: '😠', color: '#e9710f' },
];

export default function PostFeed({ posts, auth, onUpdate, onViewProfile }) {
  const [commentTexts, setCommentTexts] = useState({});
  const [showComments, setShowComments] = useState({});
  const [showReactionPicker, setShowReactionPicker] = useState({});
  const [postReactions, setPostReactions] = useState({});

  // Fetch reactions for all posts
  React.useEffect(() => {
    const fetchReactions = async () => {
      const reactions = {};
      for (const post of posts || []) {
        try {
          const reactionData = await getReactions(post.id);
          reactions[post.id] = reactionData;
        } catch (err) {
          console.error(`Failed to fetch reactions for post ${post.id}:`, err);
        }
      }
      setPostReactions(reactions);
    };
    if (posts?.length > 0) {
      fetchReactions();
    }
  }, [posts?.map(p => p.id).join(',')]); // Only refetch when post IDs change

  const handleLike = async (postId) => {
    try {
      await toggleLike(postId);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const handleReaction = async (postId, reactionType) => {
    try {
      await reactToPost(postId, reactionType);
      setShowReactionPicker(prev => ({ ...prev, [postId]: false }));
      if (onUpdate) onUpdate();
      // Refresh reactions for this post
      const reactions = await getReactions(postId);
      setPostReactions(prev => ({ ...prev, [postId]: reactions }));
    } catch (err) {
      console.error("Failed to react:", err);
    }
  };

  const handleComment = async (postId) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;

    try {
      await addComment(postId, text);
      setCommentTexts((prev) => ({ ...prev, [postId]: "" }));
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleDelete = async (postId) => {
    if (!confirm("Delete this post?")) return;
    
    try {
      await deletePost(postId);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Failed to delete post:", err);
    }
  };

  if (!posts || posts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>📍</div>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>No posts nearby</div>
        <div style={{ fontSize: "14px", marginTop: "4px" }}>
          Be the first to share something!
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {posts.map((post) => {
        const isLiked = post.likedByMe || false;
        const likeCount = post.likeCount || 0;
        const commentsCount = post.commentsCount || 0;
        const viewsCount = post.viewsCount || 0;
        const comments = post.comments || [];
        const isMyPost = post.authorId === auth.userId;

        return (
          <div
            key={post.id}
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div 
                style={{ display: "flex", gap: "12px", alignItems: "center", cursor: "pointer", flex: 1 }}
                onClick={() => onViewProfile && onViewProfile({ userId: post.authorId, displayName: post.authorName })}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: "700",
                    fontSize: "16px",
                    position: "relative",
                  }}
                >
                  {post.authorName?.charAt(0).toUpperCase() || "U"}
                  {post.authorLive && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: "14px",
                      height: "14px",
                      background: "#10b981",
                      border: "2px solid white",
                      borderRadius: "50%",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    }}></div>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "15px", color: "#1f2937" }}>
                    {post.authorName || "Unknown"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>
                    {new Date(post.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              {isMyPost && (
                <button
                  onClick={() => handleDelete(post.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #fee2e2",
                    background: "#fef2f2",
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              )}
            </div>

            {/* Content */}
            <div style={{ fontSize: "15px", lineHeight: "1.6", marginBottom: "12px", color: "#1f2937" }}>
              {post.content}
            </div>

            {/* Interests */}
            {post.interests && post.interests.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                {post.interests.map((interest, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "12px",
                      background: "#f3f4f6",
                      color: "#667eea",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}

            {/* Engagement Counts - Facebook style with reaction emojis */}
            {(() => {
              const reactions = postReactions[post.id] || {};
              const totalReactions = Object.values(reactions).reduce((sum, count) => sum + count, 0);
              const topReactions = Object.entries(reactions)
                .filter(([_, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([type]) => REACTIONS.find(r => r.type === type));
              
              const hasEngagement = totalReactions > 0 || commentsCount > 0;
              
              return hasEngagement ? (
                <div style={{ 
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px", 
                  color: "#65676b",
                  paddingTop: "12px",
                  paddingBottom: "8px"
                }}>
                  {/* Left: Top 3 reaction emojis + count */}
                  {totalReactions > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {topReactions.map((reaction, idx) => (
                          <span 
                            key={reaction.type} 
                            style={{ 
                              fontSize: "16px",
                              marginLeft: idx > 0 ? "-4px" : "0",
                              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))"
                            }}
                          >
                            {reaction.emoji}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontWeight: "400", cursor: "pointer" }}>
                        {formatCount(totalReactions)}
                      </span>
                    </div>
                  )}
                  
                  {/* Right: Comment count */}
                  {commentsCount > 0 && (
                    <span style={{ fontWeight: "400", cursor: "pointer" }}>
                      {formatCount(commentsCount)} Comment{commentsCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              ) : null;
            })()}

            {/* Actions with Reaction Picker */}
            <div style={{ 
              display: "flex", 
              gap: "8px",
              paddingTop: "8px",
              paddingBottom: "8px",
              borderTop: "1px solid #e4e6eb",
              position: "relative"
            }}>
              {/* Like button with reaction picker */}
              <div 
                style={{ flex: 1, position: "relative" }}
                onMouseEnter={() => {
                  setShowReactionPicker(prev => ({ ...prev, [post.id]: true }));
                }}
                onMouseLeave={() => {
                  // Small delay to allow moving from button to picker
                  setTimeout(() => {
                    setShowReactionPicker(prev => ({ ...prev, [post.id]: false }));
                  }, 100);
                }}
              >
                {/* Reaction Picker Popup - shown above button */}
                {showReactionPicker[post.id] && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 4px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "white",
                      borderRadius: "30px",
                      padding: "8px 12px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                      display: "flex",
                      gap: "6px",
                      zIndex: 1000,
                      animation: "slideUp 0.15s ease-out",
                    }}
                    onMouseEnter={() => {
                      // Keep picker visible when hovering over it
                      setShowReactionPicker(prev => ({ ...prev, [post.id]: true }));
                    }}
                  >
                    {REACTIONS.map((reaction) => (
                      <button
                        key={reaction.type}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReaction(post.id, reaction.type);
                          setShowReactionPicker(prev => ({ ...prev, [post.id]: false }));
                        }}
                        style={{
                          fontSize: "28px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: "6px",
                          borderRadius: "50%",
                          transition: "all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                          transform: "scale(1)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.4)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        title={reaction.type}
                      >
                        {reaction.emoji}
                      </button>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={() => handleLike(post.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px 0",
                    border: "none",
                    background: showReactionPicker[post.id] ? "#f2f3f5" : "transparent",
                    color: isLiked ? "#1877f2" : "#65676b",
                    fontWeight: "600",
                    fontSize: "15px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    borderRadius: "6px",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>{isLiked ? "👍" : "🤍"}</span>
                  <span>Like</span>
                </button>
              </div>
              
              {/* Comment button */}
              <button
                onClick={() => setShowComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "8px 0",
                  border: "none",
                  background: "transparent",
                  color: "#65676b",
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  transition: "background 0.2s",
                  borderRadius: "6px",
                }}
                onMouseOver={(e) => e.currentTarget.style.background = "#f2f3f5"}
                onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontSize: "18px" }}>💬</span>
                <span>Comment</span>
              </button>
            </div>

            {/* Comments Section */}
            {showComments[post.id] && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
                {/* Comment Input */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  <input
                    type="text"
                    value={commentTexts[post.id] || ""}
                    onChange={(e) =>
                      setCommentTexts((prev) => ({ ...prev, [post.id]: e.target.value }))
                    }
                    onKeyPress={(e) => e.key === "Enter" && handleComment(post.id)}
                    placeholder="Write a comment..."
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: "20px",
                      border: "1px solid #e5e7eb",
                      fontSize: "14px",
                    }}
                  />
                  <button
                    onClick={() => handleComment(post.id)}
                    disabled={!commentTexts[post.id]?.trim()}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "20px",
                      border: "none",
                      background: commentTexts[post.id]?.trim() ? "#667eea" : "#e5e7eb",
                      color: "white",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: commentTexts[post.id]?.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Send
                  </button>
                </div>

                {/* Comments List */}
                {comments.map((comment, idx) => (
                  <div
                    key={comment.id || idx}
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: "12px",
                      padding: "10px",
                      background: "#f9fafb",
                      borderRadius: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "700",
                        fontSize: "12px",
                        flexShrink: 0,
                      }}
                    >
                      {comment.authorName?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "2px" }}>
                        {comment.authorName || "Unknown"}
                      </div>
                      <div style={{ fontSize: "14px", color: "#374151" }}>
                        {comment.content}
                      </div>
                      <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                        {new Date(comment.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Load more comments button */}
                {commentsCount > comments.length && (
                  <button
                    onClick={() => {
                      // TODO: Implement load more functionality
                      alert('Load more comments - pagination not yet implemented in frontend');
                    }}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      background: "white",
                      color: "#667eea",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      marginTop: "8px",
                    }}
                  >
                    Load more comments ({commentsCount - comments.length} more)
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
