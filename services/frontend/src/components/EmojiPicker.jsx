import React from "react";

const EMOJI_CATEGORIES = {
  smileys: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐"],
  hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"],
  gestures: ["👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐", "🖖", "👋", "🤙", "💪", "🙏", "✍️", "👏", "🙌", "👐", "🤲"],
  symbols: ["💯", "💢", "💥", "💫", "💦", "💨", "🕊️", "🔥", "✨", "🌟", "⭐", "🌙", "☀️", "⛅", "🌈", "☁️", "⚡", "❄️", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "⚽", "🏀", "🏈", "⚾", "🎾"],
};

export default function EmojiPicker({ onEmojiSelect, onClose }) {
  const [category, setCategory] = React.useState("smileys");

  return (
    <div
      style={{
        position: "absolute",
        bottom: "70px",
        left: "16px",
        width: "320px",
        height: "280px",
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1001,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Category Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e5e7eb",
          padding: "8px",
          gap: "4px",
        }}
      >
        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: "6px 12px",
              border: "none",
              background: category === cat ? "#667eea" : "transparent",
              color: category === cat ? "white" : "#6b7280",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600",
              textTransform: "capitalize",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px",
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gap: "4px",
          alignContent: "start",
        }}
      >
        {EMOJI_CATEGORIES[category].map((emoji, idx) => (
          <button
            key={idx}
            onClick={() => {
              onEmojiSelect(emoji);
              onClose();
            }}
            style={{
              padding: "8px",
              border: "none",
              background: "transparent",
              fontSize: "24px",
              cursor: "pointer",
              borderRadius: "8px",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#f3f4f6")}
            onMouseLeave={(e) => (e.target.style.background = "transparent")}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
