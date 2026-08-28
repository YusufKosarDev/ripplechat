package com.ripplechat.backend.common;

/**
 * Placeholder text for a message that carries an attachment but no words of its
 * own, used wherever a message has to be summarised in one line.
 *
 * <p>Shared because the two call sites — the quoted-reply snapshot in the
 * message package and the web-push body in the push package — must agree: a
 * user sees both for the same message, once in the timeline and once in a
 * notification. They previously held independent copies of the literal.
 */
public final class MessagePreview {

    /** Shown in place of the body when a message is an attachment only. */
    public static final String ATTACHMENT = "📷 Image";

    /**
     * Shown in place of a quoted snapshot once the quoted message is removed.
     * The snapshot is denormalised, so without this the words survive being
     * deleted anywhere they had been quoted.
     */
    public static final String DELETED = "🗑 Message deleted";

    private MessagePreview() {
    }
}
