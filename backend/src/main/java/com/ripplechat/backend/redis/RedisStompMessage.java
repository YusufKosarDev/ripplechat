package com.ripplechat.backend.redis;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RedisStompMessage {
    private String destination;
    private String payloadJson;
}
