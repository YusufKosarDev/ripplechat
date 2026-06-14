package com.ripplechat.backend.channel;

/**
 * Regular named channel, a one-to-one direct message, or a multi-party group DM.
 * DMs/groups are private channels reusing the message, reaction, thread and
 * real-time machinery; only listing and display differ.
 */
public enum ChannelType {
    CHANNEL,
    DIRECT,
    GROUP
}
