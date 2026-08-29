package com.ripplechat.backend.outbox;

/**
 * The task types {@link OutboxTaskProcessor} knows how to run.
 *
 * <p>Named here rather than as string literals at both ends: the producer and
 * the processor live in different packages, and a typo in either one is a task
 * that is written and never picked up — which looks exactly like a queue that
 * is simply idle.
 */
public final class OutboxTaskTypes {

    /** Removes an upload from the media host. Payload: the media URL. */
    public static final String DELETE_MEDIA = "DELETE_MEDIA";

    /** (Re)indexes a message for search. Payload: the message id. */
    public static final String INDEX_MESSAGE = "INDEX_MESSAGE";

    /** Removes a message from the search index. Payload: the message id. */
    public static final String REMOVE_FROM_SEARCH_INDEX = "REMOVE_FROM_SEARCH_INDEX";

    private OutboxTaskTypes() {
    }
}
