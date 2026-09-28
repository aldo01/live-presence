package com.livepresence.feed.vibe;

/**
 * A "vibe" is a first-class, server-defined category that tags posts and
 * presence. Keeping the catalog on the server (instead of hard-coding it in the
 * web/mobile clients) means new vibes can be added in one place and every
 * surface — the filter bar, the composer, post labels — stays in sync.
 *
 * @param key      stable identifier persisted on posts (e.g. "Music"). Matches
 *                 the legacy {@code interest} string so existing data keeps working.
 * @param label    human-friendly name shown in the UI.
 * @param emoji    icon rendered next to the label.
 * @param color    accent color (hex) used for the active pill / chip.
 * @param category coarse grouping used to organise the "more vibes" menu.
 */
public record Vibe(
    String key,
    String label,
    String emoji,
    String color,
    String category
) {}
