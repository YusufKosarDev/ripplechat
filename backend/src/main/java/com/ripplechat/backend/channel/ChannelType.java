package com.ripplechat.backend.channel;

/**
 * Distinguishes regular named channels from one-to-one direct messages. A DM is
 * modelled as a private channel with two members, reusing the message, reaction,
 * thread and real-time machinery; only listing and display differ.
 */
public enum ChannelType {
    CHANNEL,
    DIRECT
}
