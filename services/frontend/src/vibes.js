// Client-side vibe helpers.
//
// The server (`GET /api/vibes`) is the source of truth for the vibe catalog.
// This module provides a matching fallback list (used before the fetch resolves
// or if the request fails) plus small lookup helpers so every surface — the
// filter bar, the composer, and per-post chips — renders vibes consistently.

export const FALLBACK_VIBES = [
  { key: "General",     label: "General",     emoji: "✨",  color: "#6b7280", category: "For You" },
  { key: "Music",       label: "Music",       emoji: "🎵", color: "#8b5cf6", category: "Creative" },
  { key: "Food",        label: "Food",        emoji: "🍔", color: "#f59e0b", category: "Food & Drink" },
  { key: "Coffee",      label: "Coffee",      emoji: "☕",  color: "#b45309", category: "Food & Drink" },
  { key: "Sports",      label: "Sports",      emoji: "⚽",  color: "#16a34a", category: "Active" },
  { key: "Fitness",     label: "Fitness",     emoji: "💪", color: "#ef4444", category: "Active" },
  { key: "Gym",         label: "Gym",         emoji: "🏋️", color: "#dc2626", category: "Active" },
  { key: "Hiking",      label: "Hiking",      emoji: "🥾", color: "#65a30d", category: "Active" },
  { key: "Travel",      label: "Travel",      emoji: "✈️", color: "#0ea5e9", category: "Lifestyle" },
  { key: "Art",         label: "Art",         emoji: "🎨", color: "#ec4899", category: "Creative" },
  { key: "Photography", label: "Photography", emoji: "📸", color: "#6366f1", category: "Creative" },
  { key: "Movies",      label: "Movies",      emoji: "🎬", color: "#7c3aed", category: "Creative" },
  { key: "Dancing",     label: "Dancing",     emoji: "💃", color: "#db2777", category: "Creative" },
  { key: "Books",       label: "Books",       emoji: "📚", color: "#0d9488", category: "Creative" },
  { key: "Fashion",     label: "Fashion",     emoji: "👗", color: "#e11d48", category: "Creative" },
  { key: "Gaming",      label: "Gaming",      emoji: "🎮", color: "#4f46e5", category: "Work & Play" },
  { key: "Tech",        label: "Tech",        emoji: "💻", color: "#2563eb", category: "Work & Play" },
  { key: "Business",    label: "Business",    emoji: "💼", color: "#334155", category: "Work & Play" },
  { key: "Cooking",     label: "Cooking",     emoji: "🍳", color: "#f97316", category: "Food & Drink" },
  { key: "Pets",        label: "Pets",        emoji: "🐾", color: "#a16207", category: "Lifestyle" },
  { key: "Wellness",    label: "Wellness",    emoji: "🧘", color: "#059669", category: "Lifestyle" },
];

export function buildVibeIndex(vibes) {
  const index = {};
  for (const v of vibes || []) {
    if (v && v.key) index[v.key.toLowerCase()] = v;
  }
  return index;
}

export function lookupVibe(index, key) {
  if (!key) return null;
  return index[String(key).toLowerCase()] || null;
}

export function vibeEmoji(index, key) {
  return lookupVibe(index, key)?.emoji || "📌";
}

export function vibeLabel(index, key) {
  return lookupVibe(index, key)?.label || key || "";
}

export function vibeColor(index, key) {
  return lookupVibe(index, key)?.color || "#667eea";
}
