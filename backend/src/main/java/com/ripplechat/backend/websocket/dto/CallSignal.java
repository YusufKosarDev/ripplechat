package com.ripplechat.backend.websocket.dto;

public record CallSignal(
    String type,
    String senderId,
    String receiverId,
    Object payload
) {}
