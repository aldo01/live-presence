package com.livepresence.notification;

/**
 * Wire contract for the {@code notif.create} Redis channel. Producers (core's
 * feed/chat code) publish this JSON; field names must stay in sync with the
 * publisher on the core side.
 */
public record NotificationCreateRequest(
    String recipientId,
    String type,
    String actorId,
    String actorDisplayName,
    String actorAvatarUrl,
    String postId,
    String commentId,
    String conversationId,
    String preview
) {}
