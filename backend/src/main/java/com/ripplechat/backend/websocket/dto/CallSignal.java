package com.ripplechat.backend.websocket.dto;

/**
 * A WebRTC signalling frame.
 *
 * @param channelId the call this belongs to. Set by the server from the
 *                  destination, and needed because a signal addressed to one
 *                  peer is delivered on their personal topic — which carries no
 *                  channel of its own, so without this the receiver cannot tell
 *                  which conversation is ringing.
 * @param senderId  the sender's user id, as the client's own id is. Filled in
 *                  from the authenticated principal, never from the body.
 */
public record CallSignal(
    String type,
    String channelId,
    String senderId,
    String receiverId,
    Object payload
) {}
