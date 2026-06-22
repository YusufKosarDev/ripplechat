package com.ripplechat.backend.search;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import org.springframework.data.elasticsearch.annotations.Setting;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "messages")
@Setting(settingPath = "/es-settings.json")
public class MessageDocument {

    @Id
    private String id;

    @Field(type = FieldType.Keyword)
    private String channelId;

    @Field(type = FieldType.Text, analyzer = "ngram_analyzer", searchAnalyzer = "standard")
    private String content;

    @Field(type = FieldType.Keyword)
    private String senderUsername;

    @Field(type = FieldType.Date)
    private Instant createdAt;
}
