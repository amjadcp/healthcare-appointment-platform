package com.healthapp.appointment.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthapp.appointment.config.RabbitMQConfig;
import com.healthapp.appointment.dto.response.DlqMessageResponse;
import com.healthapp.appointment.service.DlqService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Queries the RabbitMQ Management HTTP API to peek at DLQ messages
 * without consuming them. Uses ackmode=ack_requeue_true so messages
 * are immediately re-queued after peeking — zero message loss.
 */
@Service
public class DlqServiceImpl implements DlqService {

    private static final Logger logger = LoggerFactory.getLogger(DlqServiceImpl.class);

    @Value("${rabbitmq.management.host:localhost}")
    private String mgmtHost;

    @Value("${rabbitmq.management.port:15672}")
    private int mgmtPort;

    @Value("${spring.rabbitmq.username:guest}")
    private String mgmtUser;

    @Value("${spring.rabbitmq.password:guest}")
    private String mgmtPassword;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public DlqServiceImpl() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /** Build a Basic Auth header for the Management API. */
    private HttpHeaders buildAuthHeaders() {
        String credentials = mgmtUser + ":" + mgmtPassword;
        String encoded = Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + encoded);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    @Override
    public List<DlqMessageResponse> peekDlqMessages(int count) {
        String vhost = URLEncoder.encode("/", StandardCharsets.UTF_8);
        String queue = URLEncoder.encode(RabbitMQConfig.DLQ_QUEUE, StandardCharsets.UTF_8);
        String url = String.format("http://%s:%d/api/queues/%s/%s/get", mgmtHost, mgmtPort, vhost, queue);
        URI uri = URI.create(url);

        // ackmode=ack_requeue_true: messages are acknowledged then immediately re-queued.
        // This is a "peek" — no message is permanently removed from the DLQ.
        String requestBody = String.format(
                "{\"count\": %d, \"ackmode\": \"ack_requeue_true\", \"encoding\": \"auto\", \"truncate\": 50000}",
                Math.min(count, 100)
        );

        HttpEntity<String> entity = new HttpEntity<>(requestBody, buildAuthHeaders());

        try {
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.POST, entity, String.class);
            List<Map<String, Object>> rawMessages = objectMapper.readValue(
                    response.getBody(), new TypeReference<List<Map<String, Object>>>() {}
            );

            List<DlqMessageResponse> results = new ArrayList<>();
            int pos = 1;
            for (Map<String, Object> msg : rawMessages) {
                results.add(mapToResponse(pos++, msg));
            }
            return results;

        } catch (RestClientException e) {
            logger.error("Failed to query RabbitMQ Management API for DLQ messages: {}", e.getMessage());
            return List.of();
        } catch (Exception e) {
            logger.error("Failed to parse DLQ messages from Management API: {}", e.getMessage(), e);
            return List.of();
        }
    }

    @Override
    public long getDlqMessageCount() {
        String vhost = URLEncoder.encode("/", StandardCharsets.UTF_8);
        String queue = URLEncoder.encode(RabbitMQConfig.DLQ_QUEUE, StandardCharsets.UTF_8);
        String url = String.format("http://%s:%d/api/queues/%s/%s", mgmtHost, mgmtPort, vhost, queue);
        URI uri = URI.create(url);

        HttpEntity<Void> entity = new HttpEntity<>(buildAuthHeaders());
        try {
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);
            Map<String, Object> queueInfo = objectMapper.readValue(
                    response.getBody(), new TypeReference<Map<String, Object>>() {}
            );
            Object msgCount = queueInfo.get("messages");
            if (msgCount instanceof Number) {
                return ((Number) msgCount).longValue();
            }
        } catch (Exception e) {
            logger.error("Failed to fetch DLQ message count: {}", e.getMessage());
        }
        return 0L;
    }

    @SuppressWarnings("unchecked")
    private DlqMessageResponse mapToResponse(int position, Map<String, Object> rawMsg) {
        String exchange   = String.valueOf(rawMsg.getOrDefault("exchange", ""));
        String routingKey = String.valueOf(rawMsg.getOrDefault("routing_key", ""));
        Map<String, Object> properties = (Map<String, Object>) rawMsg.getOrDefault("properties", Map.of());
        Map<String, Object> headers    = (Map<String, Object>) properties.getOrDefault("headers", Map.of());

        // Parse payload
        Object payload = rawMsg.get("payload");
        if (payload instanceof String) {
            try {
                payload = objectMapper.readValue((String) payload, Object.class);
            } catch (Exception ignored) {
                // Keep as string if not valid JSON
            }
        }

        // Parse x-death entries for provenance
        List<DlqMessageResponse.DeathEntry> deaths = new ArrayList<>();
        Object xDeath = headers.get("x-death");
        if (xDeath instanceof List<?>) {
            for (Object entry : (List<?>) xDeath) {
                if (entry instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> deathMap = (Map<String, Object>) entry;
                    deaths.add(new DlqMessageResponse.DeathEntry(
                            String.valueOf(deathMap.getOrDefault("queue", "")),
                            String.valueOf(deathMap.getOrDefault("reason", "")),
                            String.valueOf(deathMap.getOrDefault("exchange", "")),
                            deathMap.get("count") instanceof Number n ? n.longValue() : 0L,
                            String.valueOf(deathMap.getOrDefault("time", ""))
                    ));
                }
            }
        }

        return new DlqMessageResponse(position, exchange, routingKey, headers, payload, deaths);
    }
}
