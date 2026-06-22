package com.ripplechat.backend.search;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageSearchRepository extends ElasticsearchRepository<MessageDocument, String> {

    /**
     * Finds messages by content, restricted to a list of allowed channel IDs.
     */
    Page<MessageDocument> findByContentContainingAndChannelIdIn(String content, List<String> channelIds, Pageable pageable);
}
