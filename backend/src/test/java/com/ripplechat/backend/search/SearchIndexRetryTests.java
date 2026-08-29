package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.outbox.OutboxTask;
import com.ripplechat.backend.outbox.OutboxTaskRepository;
import com.ripplechat.backend.outbox.OutboxTaskTypes;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * What happens when the search backend is unreachable.
 *
 * <p>It used to swallow its own exceptions and log them, which made every
 * failure permanent: a message the cluster briefly could not accept was never
 * searchable, and — worse — a deleted one stayed findable for good, because
 * nothing anywhere would try the removal again.
 */
@TestPropertySource(properties = "app.search.elasticsearch.enabled=true")
class SearchIndexRetryTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    SearchService searchService;
    @Autowired
    MessageRepository messageRepository;
    @Autowired
    OutboxTaskRepository outboxTaskRepository;
    @Autowired
    ChannelRepository channelRepository;

    @MockitoBean
    MessageSearchIndex searchIndex;

    private List<OutboxTask> tasksOfType(String taskType) {
        return outboxTaskRepository.findAll().stream()
                .filter(task -> taskType.equals(task.getTaskType()))
                .toList();
    }

    @Test
    void aFailedIndexIsQueuedForRetry() {
        when(searchIndex.requiresIndexing()).thenReturn(true);
        doThrow(new RuntimeException("cluster unreachable")).when(searchIndex).index(any());
        var owner = createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        Message message = new Message();
        message.setChannel(channelRepository.findById(channel.id()).orElseThrow());
        message.setSender(owner);
        message.setContent("pineapple");
        Message saved = messageRepository.saveAndFlush(message);

        searchService.indexMessage(saved);

        assertThat(tasksOfType(OutboxTaskTypes.INDEX_MESSAGE))
                .singleElement()
                .satisfies(task -> {
                    assertThat(task.getPayload()).isEqualTo(saved.getId().toString());
                    assertThat(task.getStatus()).isEqualTo(OutboxTask.Status.PENDING);
                });
    }

    @Test
    void aFailedRemovalIsQueuedForRetry() {
        when(searchIndex.requiresIndexing()).thenReturn(true);
        UUID messageId = UUID.randomUUID();
        doThrow(new RuntimeException("cluster unreachable")).when(searchIndex).delete(messageId);

        searchService.deleteMessage(messageId);

        assertThat(tasksOfType(OutboxTaskTypes.REMOVE_FROM_SEARCH_INDEX))
                .singleElement()
                .extracting(OutboxTask::getPayload)
                .isEqualTo(messageId.toString());
    }

    @Test
    void nothingIsQueuedWhenTheIndexAcceptsTheWrite() {
        when(searchIndex.requiresIndexing()).thenReturn(true);

        searchService.deleteMessage(UUID.randomUUID());

        assertThat(tasksOfType(OutboxTaskTypes.REMOVE_FROM_SEARCH_INDEX)).isEmpty();
    }

    @Test
    void nothingIsQueuedForABackendThatDoesNotNeedIndexing() {
        // PostgreSQL: the rows are the index, so a task per message would be
        // churn on the deployment that runs without Elasticsearch.
        when(searchIndex.requiresIndexing()).thenReturn(false);
        doThrow(new RuntimeException("should never be called")).when(searchIndex).delete(any(UUID.class));

        searchService.deleteMessage(UUID.randomUUID());

        assertThat(tasksOfType(OutboxTaskTypes.REMOVE_FROM_SEARCH_INDEX)).isEmpty();
    }

    @Test
    void aRetryOfADeletedMessageRemovesItRatherThanIndexingIt() {
        when(searchIndex.requiresIndexing()).thenReturn(true);
        var owner = createUser("owner_retry");
        var channel = channelService.create(new CreateChannelRequest("c2", null, false), "owner_retry");
        Message message = new Message();
        message.setChannel(channelRepository.findById(channel.id()).orElseThrow());
        message.setSender(owner);
        message.setContent("gone by the time the retry runs");
        message.setDeleted(true);
        Message saved = messageRepository.saveAndFlush(message);

        searchService.applyIndex(saved.getId());

        verify(searchIndex).delete(saved.getId());
    }

    @Test
    void aRetryOfAMessageThatNoLongerExistsRemovesIt() {
        when(searchIndex.requiresIndexing()).thenReturn(true);
        UUID missing = UUID.randomUUID();

        searchService.applyIndex(missing);

        verify(searchIndex).delete(missing);
    }
}
