package com.livepresence.feed.vibe;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The single source of truth for the vibes users can browse and post with.
 *
 * <p>Order matters: the list is rendered top-to-bottom, so the most popular
 * vibes are listed first. The {@code key} of each vibe is what gets persisted
 * on a post (in the existing {@code posts.interest} column), which keeps this
 * catalog backwards-compatible with data created before vibes were a first
 * class concept.
 */
public final class VibeCatalog {

    /** Neutral vibe used as the default when a user has not picked one. */
    public static final String GENERAL = "General";

    private static final List<Vibe> VIBES = List.of(
        new Vibe("General",     "General",     "\u2728",       "#6b7280", "For You"),
        new Vibe("Music",       "Music",       "\uD83C\uDFB5", "#8b5cf6", "Creative"),
        new Vibe("Food",        "Food",        "\uD83C\uDF54", "#f59e0b", "Food & Drink"),
        new Vibe("Coffee",      "Coffee",      "\u2615",       "#b45309", "Food & Drink"),
        new Vibe("Sports",      "Sports",      "\u26BD",       "#16a34a", "Active"),
        new Vibe("Fitness",     "Fitness",     "\uD83D\uDCAA", "#ef4444", "Active"),
        new Vibe("Gym",         "Gym",         "\uD83C\uDFCB\uFE0F", "#dc2626", "Active"),
        new Vibe("Hiking",      "Hiking",      "\uD83E\uDD7E", "#65a30d", "Active"),
        new Vibe("Travel",      "Travel",      "\u2708\uFE0F", "#0ea5e9", "Lifestyle"),
        new Vibe("Art",         "Art",         "\uD83C\uDFA8", "#ec4899", "Creative"),
        new Vibe("Photography", "Photography", "\uD83D\uDCF8", "#6366f1", "Creative"),
        new Vibe("Movies",      "Movies",      "\uD83C\uDFAC", "#7c3aed", "Creative"),
        new Vibe("Dancing",     "Dancing",     "\uD83D\uDC83", "#db2777", "Creative"),
        new Vibe("Books",       "Books",       "\uD83D\uDCDA", "#0d9488", "Creative"),
        new Vibe("Fashion",     "Fashion",     "\uD83D\uDC57", "#e11d48", "Creative"),
        new Vibe("Gaming",      "Gaming",      "\uD83C\uDFAE", "#4f46e5", "Work & Play"),
        new Vibe("Tech",        "Tech",        "\uD83D\uDCBB", "#2563eb", "Work & Play"),
        new Vibe("Business",    "Business",    "\uD83D\uDCBC", "#334155", "Work & Play"),
        new Vibe("Cooking",     "Cooking",     "\uD83C\uDF73", "#f97316", "Food & Drink"),
        new Vibe("Pets",        "Pets",        "\uD83D\uDC3E", "#a16207", "Lifestyle"),
        new Vibe("Wellness",    "Wellness",    "\uD83E\uDDD8", "#059669", "Lifestyle")
    );

    private static final Map<String, Vibe> BY_KEY = index(VIBES);

    private VibeCatalog() {}

    public static List<Vibe> all() {
        return VIBES;
    }

    public static Optional<Vibe> byKey(String key) {
        if (key == null) return Optional.empty();
        return Optional.ofNullable(BY_KEY.get(key.trim().toLowerCase()));
    }

    /** True if the given string names a known vibe (case-insensitive). */
    public static boolean isKnown(String key) {
        return byKey(key).isPresent();
    }

    private static Map<String, Vibe> index(List<Vibe> vibes) {
        Map<String, Vibe> map = new LinkedHashMap<>();
        for (Vibe v : vibes) {
            map.put(v.key().toLowerCase(), v);
        }
        return map;
    }
}
